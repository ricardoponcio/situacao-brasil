import type { SubjectStage, SubjectStatus } from '@sb/core';
import { afterCongress, result } from '../camara-votacoes/status.ts';

/**
 * Traduz a situação de um processo no Senado ("AGUARDANDO DESPACHO", "REMETIDA À SANÇÃO"...) para o passo
 * atual e o próximo, no mesmo vocabulário da Câmara (`camaraStatus`) e do diagrama "Como uma lei é feita".
 *
 * Siglas: /processo/tipos-situacao, /processo/tipos-decisao e /processo/destinos da API de Dados Abertos.
 */

/** O que a coleta usa de /processo/{id}. */
export interface SenadoProcesso {
  id: number;
  codigoMateria?: number;
  identificacao: string;
  sigla: string;
  numero: string;
  ano: number;
  /** Iniciadora (a proposta começou no Senado) ou Revisora (veio da Câmara) */
  objetivo?: string;
  casaIdentificadora: string;
  siglaCasaIniciadora?: string;
  identificacaoProcessoInicial?: string;
  tramitando: string;
  situacaoAtual: string;
  siglaSituacaoAtual: string;
  dataSituacaoAtual?: string;
  conteudo?: { ementa?: string };
  deliberacao?: { data?: string; siglaTipo?: string; tipoDeliberacao?: string; siglaDestino?: string };
  normaGerada?: Record<string, unknown>;
  autuacoes?: {
    situacoes?: { sigla: string; inicio: string; colegiado?: { sigla: string; nome: string } }[];
  }[];
}

const NA_PAUTA = new Set(['INCLOD', 'AGDDO', 'PRONDEPLEN']);
const CHEGANDO = new Set(['AGDESP', 'AGLEIT', 'LEITURA', 'AUTUAFIN', 'MATDESP']);
const ARQUIVADA = new Set(['ARQV', 'ARQVD', 'ARQV_CD']);
const APROVADA = new Set(['APROVADA_NO_PLENARIO', 'APROVADO_PLV', 'APROVADA_PARCIALMENTE', 'APROVADO_NA_INTEGRA', 'APROVADA_EM_COMISSAO_TERMINATIVA']);
const REJEITADA = new Set(['REJEITADO_PLENARIO', 'REJEITADO_COMISSAO_TERM', 'REJEITADO_INCONSTICIONALIDADE_CCJ']);

/** Onde o texto vai depois de o Congresso terminar, para tipos que só existem no Senado. */
function depoisDoCongresso(tipo: string): SubjectStage {
  if (tipo === 'PRS') return { label: 'Senado promulga a resolução', where: 'senado' };
  return afterCongress(tipo);
}

/** Comissão onde o processo está agora (CAE, CCJ...), ou "PLEN" quando está com a Mesa ou o Plenário. */
function colegiadoAtual(p: SenadoProcesso): string | undefined {
  const situacoes = p.autuacoes?.[0]?.situacoes ?? [];
  return situacoes.at(-1)?.colegiado?.sigla;
}

/** Resultado da decisão final, no vocabulário do feed (aprovada, rejeitada...). */
export function senadoOutcome(siglaTipo: string | undefined): string | undefined {
  if (!siglaTipo) return undefined;
  if (APROVADA.has(siglaTipo)) return 'aprovada';
  if (REJEITADA.has(siglaTipo)) return 'rejeitada';
  if (siglaTipo === 'PERDA_EFICACIA') return 'perdeu-validade';
  if (siglaTipo === 'PREJUDICADO') return 'prejudicada';
  if (siglaTipo === 'RETIRADO_PELO_AUTOR') return 'retirada';
  return undefined;
}

export function senadoStatus(p: SenadoProcesso): SubjectStatus {
  const tipo = p.sigla;
  const sit = p.siglaSituacaoAtual;
  const base = { official: `Senado: ${p.situacaoAtual.trim()}`, since: p.dataSituacaoAtual };
  const status = (now: SubjectStage, next?: SubjectStage, done = false): SubjectStatus => ({ ...base, now, next, done });
  const veioDaCamara = p.siglaCasaIniciadora === 'CD' || p.objetivo === 'Revisora';
  const d = p.deliberacao ?? {};
  const presidente = { where: 'presidencia' as const, step: tipo === 'MPV' ? 'sancao' : 'presidente' };

  // Caminho encerrado.
  if (sit === 'TNJR' || (p.normaGerada && Object.keys(p.normaGerada).length > 0 && sit !== 'TNJRVETO')) {
    return status(result(tipo === 'PEC' ? 'Virou emenda à Constituição' : 'Virou lei', tipo === 'PEC' ? 'emenda' : 'lei'), undefined, true);
  }
  if (sit === 'TNJRVETO') return status(result('Virou lei, com partes vetadas pelo Presidente', 'lei'), undefined, true);
  if (d.siglaTipo === 'PERDA_EFICACIA' || sit === 'SEFICA') return status(result('Perdeu a validade (não foi votada a tempo)', 'perde-validade'), undefined, true);
  if (d.siglaTipo && REJEITADA.has(d.siglaTipo)) return status(result('Rejeitada no Senado', tipo === 'PEC' ? 'arquivada' : 'arquivado'), undefined, true);
  if (d.siglaTipo === 'PREJUDICADO' || sit === 'PRJDA') return status(result('Ficou prejudicada (perdeu o objeto ou foi superada por outra)'), undefined, true);
  if (d.siglaTipo === 'RETIRADO_PELO_AUTOR' || sit === 'RTPA') return status(result('Retirada por quem propôs'), undefined, true);
  if (ARQUIVADA.has(sit) || d.siglaDestino === 'ARQUIVO') return status(result('Arquivada', tipo === 'PEC' ? 'arquivada' : 'arquivado'), undefined, true);

  // Decidida no Senado: para onde foi o texto.
  if (sit === 'VTDA') return status({ label: 'O Presidente vetou o texto', ...presidente }, { label: 'Congresso decide se mantém ou derruba o veto', where: 'congresso', step: 'veto' });
  if (d.siglaDestino === 'SANCAO') {
    return sit === 'RMSAN'
      ? status({ label: 'Aprovada pelo Congresso. Está com o Presidente', ...presidente }, result('Vira lei se for sancionada; o que for vetado volta ao Congresso'))
      : status({ label: 'Aprovada no Senado. Aguardando envio ao Presidente', where: 'senado' }, { label: 'Presidente sanciona (assina) ou veta', ...presidente });
  }
  if (d.siglaDestino === 'PROMULGACAO') {
    return status({ label: 'Aprovada no Senado. Aguardando promulgação', where: tipo === 'PRS' ? 'senado' : 'congresso', step: 'promulgacao' }, result('Passa a valer quando for publicada'));
  }
  if (d.siglaDestino === 'CAMARA') {
    return veioDaCamara
      ? status(
          { label: 'O Senado mudou o texto. Ele volta para a Câmara', where: 'camara', step: 'volta-camara' },
          { label: 'Câmara decide se aceita as mudanças do Senado. Depois, vai ao Presidente', where: 'camara', step: 'volta-camara' },
        )
      : status(
          { label: 'Aprovada no Senado. Agora vai para a Câmara', where: 'camara' },
          { label: 'Câmara vota. Se aprovar sem mudar o texto, segue adiante. Se mudar, volta para o Senado', where: 'camara' },
        );
  }
  if (d.siglaTipo && APROVADA.has(d.siglaTipo)) {
    return status({ label: 'Aprovada no Senado. Texto final sendo preparado', where: 'senado' }, veioDaCamara || tipo === 'MPV' ? depoisDoCongresso(tipo) : undefined);
  }

  // Ainda em análise no Senado.
  const vota: SubjectStage = veioDaCamara
    ? tipo === 'MPV' || tipo === 'PEC' || tipo === 'PDL'
      ? { label: `Senado vota. Se aprovar: ${depoisDoCongresso(tipo).label}`, where: 'senado' }
      : { label: 'Senado vota. Se aprovar sem mudar o texto, vai ao Presidente. Se mudar, volta para a Câmara', where: 'senado' }
    : { label: 'Senado vota. Se aprovar, vai para a Câmara', where: 'senado' };
  const step = tipo === 'MPV' ? 'plenario-senado' : veioDaCamara ? 'senado' : undefined;
  const onde = colegiadoAtual(p);

  if (NA_PAUTA.has(sit)) return status({ label: 'Na pauta do Plenário do Senado, pronta para ser votada', where: 'senado', step }, vota);
  if (sit === 'AGREMD' || sit === 'AGREMESA') return status({ label: 'No Senado, no prazo para senadores sugerirem mudanças (emendas)', where: 'senado', step }, vota);
  if (CHEGANDO.has(sit) && (!onde || onde === 'PLEN')) {
    return status({ label: 'Chegou ao Senado. Esperando ser enviada às comissões', where: 'senado', step }, vota);
  }
  if (onde && onde !== 'PLEN') return status({ label: `Em análise numa comissão do Senado (${onde})`, where: 'senado', step }, vota);
  return status({ label: 'Em análise no Senado', where: 'senado', step }, vota);
}
