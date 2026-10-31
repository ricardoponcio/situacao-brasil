import type { SubjectStage, SubjectStatus } from '@sb/core';

/**
 * Traduz a situação oficial de uma proposição na Câmara ("Aguardando Apreciação pelo Senado
 * Federal", "Transformado em Norma Jurídica"...) para o passo atual e o próximo, em linguagem
 * simples e no vocabulário do diagrama "Como uma lei é feita" (ids de etapa em `step`).
 *
 * Códigos: /referencias/proposicoes/codSituacao da API de Dados Abertos.
 */

export interface CamaraSituation {
  siglaTipo: string;
  codSituacao: number;
  descricaoSituacao: string;
  /** Órgão onde a proposição está (CCJC, PLEN, MESA...) */
  siglaOrgao: string;
  dataHora?: string;
  /** Para onde o Plenário mandou o texto, lido do último despacho "A matéria vai ao/à ..." */
  destino?: Destino;
}

export type Destino = 'senado' | 'sancao' | 'promulgacao' | 'camara';

/** Lê o destino de um despacho como "A matéria vai ao Senado Federal (PL 1.123-A/2025)." */
export function destinoFromDespacho(despacho: string): Destino | undefined {
  const m = /mat[ée]ria\s+vai\s+(?:ao|à|a)\s+(Senado|san[çc][ãa]o|promulga[çc][ãa]o|C[âa]mara)/i.exec(despacho);
  if (!m?.[1]) return undefined;
  const d = m[1].toLowerCase();
  if (d.startsWith('senado')) return 'senado';
  if (d.startsWith('san')) return 'sancao';
  if (d.startsWith('promulga')) return 'promulgacao';
  return 'camara';
}

const ARQUIVADA = new Set([923, 930, 931, 914, 940]);
const NO_SENADO = new Set([926, 1303]);
/** Aprovada no Plenário da Câmara, com papelada pendente antes de seguir. */
const APROVADA_NA_CAMARA = new Set([900, 929, 1270, 1293]);
const AGUARDANDO_ENVIO_SANCAO = new Set([1160, 1070]);

/** Tipos que, aprovados nas duas Casas, terminam em promulgação (sem sanção do Presidente). */
export const PROMULGA = new Set(['PEC', 'PDL', 'PRC']);

/** Etapa final quando o Congresso termina de aprovar o texto. */
export function afterCongress(tipo: string): SubjectStage {
  if (tipo === 'PRC') return { label: 'Câmara promulga a resolução', where: 'camara' };
  if (PROMULGA.has(tipo)) return { label: 'Câmara e Senado promulgam o texto', where: 'congresso', step: 'promulgacao' };
  return { label: 'Presidente sanciona (assina) ou veta', where: 'presidencia', step: tipo === 'MPV' ? 'sancao' : 'presidente' };
}

export function result(label: string, step?: string): SubjectStage {
  return { label, where: 'resultado', step };
}

function nextFromDestino(tipo: string, destino: Destino | undefined): SubjectStage | undefined {
  switch (destino) {
    case 'senado':
      return {
        label: 'Senado analisa e vota',
        where: 'senado',
        step: tipo === 'MPV' ? 'plenario-senado' : 'senado',
      };
    case 'sancao':
      return { label: 'Presidente sanciona (assina) ou veta', where: 'presidencia', step: tipo === 'MPV' ? 'sancao' : 'presidente' };
    case 'promulgacao':
      return afterCongress(tipo);
    default:
      return undefined;
  }
}

/** Órgãos administrativos: a proposição está "na Câmara", mas não numa comissão. */
const ADMIN = new Set(['MESA', 'CCP', 'SGM', 'CCJCADM', 'COPER']);

export function camaraStatus(s: CamaraSituation): SubjectStatus {
  const tipo = s.siglaTipo;
  const base = { official: s.descricaoSituacao.trim(), since: s.dataHora };
  const c = s.codSituacao;
  const status = (now: SubjectStage, next?: SubjectStage, done = false): SubjectStatus => ({ ...base, now, next, done });

  // Caminho encerrado.
  if (c === 1140) return status(result(tipo === 'PEC' ? 'Virou emenda à Constituição' : 'Virou lei', tipo === 'PEC' ? 'emenda' : 'lei'), undefined, true);
  if (ARQUIVADA.has(c)) return status(result('Arquivada', tipo === 'PEC' ? 'arquivada' : 'arquivado'), undefined, true);
  if (c === 950) return status(result('Retirada por quem propôs'), undefined, true);
  if (c === 1120) return status(result('Devolvida a quem propôs'), undefined, true);
  if (c === 1222) return status(result('Ficou prejudicada (perdeu o objeto ou foi superada por outra)'), undefined, true);
  if (c === 1292) return status(result('Perdeu a validade', 'perde-validade'), undefined, true);
  if (c === 1230) return status(result('Virou outra proposta'), undefined, true);
  if (c === 941) return status(result('Recusada'), undefined, true);
  if (c === 1285) return status(result('Tramitação encerrada'), undefined, true);

  // Fora da Câmara.
  if (NO_SENADO.has(c)) {
    return status(
      { label: 'Aprovada na Câmara. Agora está no Senado, esperando análise', where: 'senado', step: tipo === 'MPV' ? 'plenario-senado' : 'senado' },
      {
        label:
          tipo === 'MPV' || PROMULGA.has(tipo)
            ? `Senado vota. Se aprovar: ${afterCongress(tipo).label}`
            : 'Senado vota. Se aprovar sem mudar o texto, vai ao Presidente. Se mudar, volta para a Câmara',
        where: 'senado',
      },
    );
  }
  if (c === 1150) return status({ label: 'Aprovada pelo Congresso. Está com o Presidente', where: 'presidencia', step: tipo === 'MPV' ? 'sancao' : 'presidente' }, result('Vira lei se for sancionada; o que for vetado volta ao Congresso'));
  if (AGUARDANDO_ENVIO_SANCAO.has(c)) return status({ label: 'Aprovada pelo Congresso. Aguardando envio ao Presidente', where: 'camara' }, afterCongress(tipo));
  if (c === 937) return status({ label: 'O Presidente vetou o texto inteiro', where: 'presidencia', step: 'presidente' }, { label: 'Congresso decide se mantém ou derruba o veto', where: 'congresso', step: 'veto' });
  if (c === 939) return status({ label: 'Vetada pelo Presidente. Congresso vai analisar o veto', where: 'congresso', step: 'veto' }, result('Veto mantido ou derrubado'));
  if (c === 1294) return status({ label: 'Aprovada. Aguardando promulgação', where: PROMULGA.has(tipo) && tipo !== 'PRC' ? 'congresso' : 'camara', step: 'promulgacao' }, result('Passa a valer quando for publicada'));
  if (c === 1299) return status({ label: 'Enviada ao Congresso Nacional', where: 'congresso' });

  // Aprovada no Plenário da Câmara, ainda saindo da Casa.
  if (APROVADA_NA_CAMARA.has(c)) {
    const next = nextFromDestino(tipo, s.destino);
    return status(
      {
        label:
          c === 929 || c === 1270
            ? 'Aprovada no Plenário da Câmara. Falta votar o texto final'
            : s.destino === 'sancao' || s.destino === 'promulgacao'
              ? 'Aprovada na Câmara e no Senado. Texto final sendo preparado'
              : 'Aprovada no Plenário da Câmara. Texto final sendo preparado para envio',
        where: 'camara',
        step: 'plenario-camara',
      },
      next ?? { label: 'Segue para o Senado ou para o Presidente', where: 'senado' },
    );
  }

  // Ainda na Câmara.
  const nextVote: SubjectStage = { label: 'Plenário da Câmara vota', where: 'camara', step: 'plenario-camara' };
  if (c === 924 || s.siglaOrgao === 'PLEN') {
    return status({ label: 'Pronta para ser votada no Plenário da Câmara', where: 'camara', step: 'plenario-camara' }, nextVote);
  }
  if (c === 925) return status({ label: 'Tramita junto com outra proposta parecida, na Câmara', where: 'camara' });
  if (tipo === 'MPV' && /^(MPV|CM)/.test(s.siglaOrgao)) {
    return status({ label: 'Em análise na comissão mista (deputados e senadores)', where: 'congresso', step: 'comissao-mista' }, nextVote);
  }
  if (ADMIN.has(s.siglaOrgao)) return status({ label: 'Em andamento na Câmara', where: 'camara' }, { label: 'Comissões ou Plenário da Câmara votam', where: 'camara' });
  return status(
    { label: `Em análise numa comissão da Câmara (${s.siglaOrgao})`, where: 'camara', step: tipo === 'PEC' ? undefined : 'comissoes' },
    { label: 'Comissões ou Plenário da Câmara votam', where: 'camara' },
  );
}
