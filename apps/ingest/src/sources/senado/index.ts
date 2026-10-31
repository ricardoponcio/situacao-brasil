import type { DatasetDescriptor, EventSubject, SubjectStatus } from '@sb/core';
import { BaseProcessor, type Emission } from '../../framework/BaseProcessor.ts';
import type { FetchResult } from '../../framework/HttpClient.ts';
import type { RunContext } from '../../framework/Processor.ts';
import { SENADO_API, getProcesso, senadoPage } from './api.ts';
import { senadoOutcome, senadoStatus, type SenadoProcesso } from './status.ts';

const DATASET = 'senado-plenario';
const VETOS = 'congresso-vetos';

/** Tipos que viram ou mudam leis. Requerimentos, ofícios e indicações de autoridades ficam de fora. */
const TIPOS = new Set(['PL', 'PLP', 'PEC', 'PDL', 'PRS', 'MPV', 'PLN']);

interface ProcessoResumo {
  id: number;
  identificacao: string;
  dataDeliberacao?: string;
  siglaTipoDeliberacao?: string;
}

interface VotacaoNominal {
  codigoSessaoVotacao: number;
  idProcesso: number;
  sigla: string;
  identificacao: string;
  dataSessao: string;
  descricaoVotacao: string;
  resultadoVotacao: string;
  votacaoSecreta: string;
  votos?: { siglaVotoParlamentar: string }[];
}

/** Veto como vem de /processo?sigla=VET (a lista já traz o que precisamos, sem buscar o detalhe). */
interface VetoResumo {
  id: number;
  codigoMateria?: number;
  identificacao: string;
  ementa: string;
  dataApresentacao: string;
  situacaoAtual?: string | null;
  dataSituacaoAtual?: string | null;
  tramitando?: string;
  siglaTipoDeliberacao?: string | null;
  dataDeliberacao?: string | null;
}

/** Resultado da sessão do Congresso sobre o veto, no vocabulário do feed e em linguagem simples. */
const RESULTADO_VETO: Record<string, { outcome: string; label: string }> = {
  MANTIDA_MATE: { outcome: 'mantido', label: 'Veto mantido: a parte vetada não vira lei' },
  REJEITADO_PLENARIO: { outcome: 'derrubado', label: 'Veto derrubado: a parte vetada passa a valer como lei' },
  MANTIDO_PARCIALMENTE: { outcome: 'mantido-em-parte', label: 'Parte do veto foi mantida e parte foi derrubada' },
  PREJUDICADO: { outcome: 'prejudicada', label: 'O veto deixou de ser analisado (perdeu o objeto)' },
};

/** Em que pé está o veto. */
function vetoStatus(v: VetoResumo): SubjectStatus {
  const base = { official: v.situacaoAtual ? `Senado: ${v.situacaoAtual}` : 'Senado: veto deliberado', since: v.dataSituacaoAtual ?? v.dataDeliberacao ?? undefined };
  const r = v.siglaTipoDeliberacao ? RESULTADO_VETO[v.siglaTipoDeliberacao] : undefined;
  if (r || v.dataDeliberacao) {
    return { ...base, now: { label: r?.label ?? 'O Congresso já decidiu sobre o veto', where: 'resultado', step: r?.outcome === 'derrubado' ? 'derrubado' : r?.outcome === 'mantido' ? 'mantido' : undefined }, done: true };
  }
  const trava = /SOBRESTANDO/i.test(v.situacaoAtual ?? '');
  return {
    ...base,
    now: {
      label: trava
        ? 'O prazo de 30 dias acabou: o veto passa à frente das outras votações do Congresso'
        : 'Esperando o Congresso analisar o veto',
      where: 'congresso',
      step: 'sessao',
    },
    next: {
      label: 'Deputados e senadores votam juntos. Para derrubar o veto são precisos 257 deputados e 41 senadores',
      where: 'congresso',
      step: 'sessao',
    },
    done: false,
  };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Decisões e votações nominais do Plenário do Senado Federal (eventos). */
class SenadoProcessor extends BaseProcessor {
  constructor() {
    super(
      {
        id: 'senado',
        name: 'Senado Federal – Plenário',
        publisher: 'Senado Federal',
        homepage: 'https://www12.senado.leg.br/dados-abertos',
        docsUrl: 'https://legis.senado.leg.br/dadosabertos/v3/swagger-ui/index.html',
        license: 'Dados abertos do Senado Federal; uso livre com citação da fonte.',
        access: { method: 'api-rest', auth: 'nenhuma' },
        publishFrequency: 'tempo-real',
        coverage: { territorial: ['pais'], temporal: 'Processos legislativos e votações nominais registrados no sistema do Senado.' },
        limitations: [
          'Votações simbólicas não têm registro separado: aparecem só como a decisão final sobre a proposta.',
          'Requerimentos, ofícios e aprovação de autoridades (embaixadores, diretores de agências) ainda não entram.',
          'Medidas provisórias que perdem a validade aparecem aqui porque o Senado registra o fim do prazo, mesmo sem votação.',
          'Vetos são votados em sessão conjunta do Congresso; o Senado é quem publica esses dados.',
        ],
      },
      '0.2.0',
    );
  }

  datasets(): DatasetDescriptor[] {
    return [
      this.describe({
        id: DATASET,
        title: 'Decisões no Plenário do Senado',
        kind: 'event',
        theme: 'politica',
        frequency: 'tempo-real',
        explanation: {
          simple:
            'O que o Senado decidiu sobre projetos de lei, mudanças na Constituição e medidas provisórias. Para cada proposta, mostra em que passo ela está agora e o que ainda falta: se vai ao Presidente, volta para a Câmara ou já virou lei.',
          technical:
            'Decisões finais: /processo da API de Dados Abertos do Senado, filtrado por data de deliberação (dataInicioDeliberacao/dataFimDeliberacao). Votações nominais: /votacao por data da sessão, com a contagem de votos Sim e Não. Situação atual de cada proposta: /processo/{id} (situação, deliberação e destino). Só os tipos PL, PLP, PEC, PDL, PRS, MPV e PLN.',
        },
        view: { type: 'feed', options: { groupBySubject: true } },
        caveats: [
          'Uma proposta aprovada no Senado nem sempre virou lei: se veio da Câmara e o Senado mudou o texto, ela volta para a Câmara; se começou no Senado, ainda vai para a Câmara.',
          'A maioria das decisões é simbólica (sem registro do voto de cada senador). Só as votações nominais mostram quantos votaram Sim e Não.',
        ],
        featured: true,
        summary: {
          template: 'Nos últimos {days} dias, o Plenário do Senado decidiu sobre {subjects} propostas.',
          windowDays: 30,
        },
        originDocs: 'https://legis.senado.leg.br/dadosabertos/v3/swagger-ui/index.html',
      }),
      this.describe({
        id: VETOS,
        title: 'Vetos do Presidente',
        kind: 'event',
        theme: 'politica',
        frequency: 'tempo-real',
        explanation: {
          simple:
            'Quando o Presidente não concorda com uma lei aprovada, ele pode vetar tudo ou só uma parte. A parte vetada não vale, mas o Congresso pode derrubar o veto. Aqui aparece cada veto, se o Congresso já decidiu e o que decidiu.',
          technical:
            'Processos do tipo VET (veto) na API de Dados Abertos do Senado (/processo?sigla=VET&ano=...), do ano corrente e do anterior. A situação vem de situacaoAtual; o resultado, de siglaTipoDeliberacao (MANTIDA_MATE = mantido, REJEITADO_PLENARIO = derrubado, MANTIDO_PARCIALMENTE = em parte).',
        },
        view: { type: 'feed', options: { groupBySubject: true } },
        caveats: [
          'Veto parcial: só alguns trechos foram vetados; o resto da lei já está valendo.',
          'Muitos vetos ficam meses sem ser votados. Depois de 30 dias, o veto passa à frente das outras votações nas sessões do Congresso.',
        ],
        featured: false,
        summary: {
          template: 'Nos últimos {days} dias, {subjects} vetos tiveram novidade (veto novo ou decisão do Congresso).',
          windowDays: 90,
        },
        originDocs: 'https://www.congressonacional.leg.br/materias/vetos',
      }),
    ];
  }

  protected async *collect(ctx: RunContext): AsyncIterable<Emission> {
    const dias = Number(ctx.options.dias ?? 30);
    const end = new Date();
    let cursor = new Date(end.getTime() - dias * 86_400_000);
    // Detalhe de cada processo, buscado uma vez por execução (decisão e votações nominais da mesma proposta).
    const processos = new Map<number, Promise<FetchResult<SenadoProcesso> | undefined>>();
    const processoOf = (id: number) => {
      if (!processos.has(id)) {
        processos.set(
          id,
          getProcesso(ctx, id).catch((err: Error) => {
            ctx.issue(`detalhe do processo ${id}: ${err.message}`);
            return undefined;
          }),
        );
      }
      return processos.get(id)!;
    };

    // Janelas de 30 dias (a API de votações aceita no máximo 60).
    while (cursor < end) {
      const windowEnd = new Date(Math.min(cursor.getTime() + 29 * 86_400_000, end.getTime()));
      const ini = isoDate(cursor);
      const fim = isoDate(windowEnd);

      const decididos = await ctx.http.getJson<ProcessoResumo[]>(
        `${SENADO_API}/processo?dataInicioDeliberacao=${ini}&dataFimDeliberacao=${fim}`,
      );
      for (const r of decididos.data) {
        if (!TIPOS.has(r.identificacao.split(' ')[0]!) || !r.dataDeliberacao) continue;
        const detail = await processoOf(r.id);
        if (!detail) continue;
        yield this.decisao(detail);
      }

      const votacoes = await ctx.http.getJson<VotacaoNominal[]>(`${SENADO_API}/votacao?dataInicio=${ini}&dataFim=${fim}`);
      for (const v of votacoes.data) {
        if (!TIPOS.has(v.sigla)) continue;
        const detail = await processoOf(v.idProcesso);
        yield this.votacao(v, detail?.data, votacoes.origin);
      }
      cursor = new Date(windowEnd.getTime() + 86_400_000);
    }

    yield* this.vetos(ctx);
  }

  /** Vetos do ano corrente e do anterior: quando o Presidente vetou e, se houve, a decisão do Congresso. */
  private async *vetos(ctx: RunContext): AsyncIterable<Emission> {
    const ano = new Date().getFullYear();
    for (const a of [ano - 1, ano]) {
      const res = await ctx.http.getJson<VetoResumo[]>(`${SENADO_API}/processo?sigla=VET&ano=${a}`);
      for (const v of res.data) {
        const total = /veto total/i.test(v.ementa);
        const subject: EventSubject = {
          id: `senado-processo:${v.id}`,
          kind: 'VET',
          label: v.identificacao,
          title: v.ementa,
          url: v.codigoMateria ? senadoPage(v.codigoMateria) : undefined,
          status: vetoStatus(v),
        };
        const links = [{ label: 'O veto na API do Senado', url: `${SENADO_API}/processo/${v.id}` }];
        yield this.emit(VETOS, res.origin, {
          kind: 'event',
          id: `veto-aposto:${v.id}`,
          occurredAt: v.dataApresentacao,
          title: total ? 'O Presidente vetou o projeto inteiro' : 'O Presidente vetou parte do projeto',
          category: 'veto',
          outcome: total ? 'veto-total' : 'veto-parcial',
          subject,
          decidedBy: 'presidencia',
          links,
          attributes: { idProcesso: v.id, total },
        });
        if (v.dataDeliberacao) {
          const r = v.siglaTipoDeliberacao ? RESULTADO_VETO[v.siglaTipoDeliberacao] : undefined;
          yield this.emit(VETOS, res.origin, {
            kind: 'event',
            id: `veto-deliberado:${v.id}:${v.dataDeliberacao}`,
            occurredAt: v.dataDeliberacao,
            title: r?.label ?? 'O Congresso decidiu sobre o veto',
            category: 'decisao-final',
            outcome: r?.outcome,
            subject,
            decidedBy: 'congresso',
            links,
            attributes: { idProcesso: v.id, deliberacao: v.siglaTipoDeliberacao ?? null },
          });
        }
      }
    }
  }

  private subject(p: SenadoProcesso): EventSubject {
    return {
      id: `senado-processo:${p.id}`,
      kind: p.sigla,
      label: p.identificacao,
      title: p.conteudo?.ementa ?? p.identificacao,
      url: p.codigoMateria ? senadoPage(p.codigoMateria) : undefined,
      status: senadoStatus(p),
    };
  }

  private links(p: SenadoProcesso) {
    return [{ label: 'Situação atual da proposta (API do Senado)', url: `${SENADO_API}/processo/${p.id}` }];
  }

  /** A decisão final do Senado sobre a proposta (aprovada, rejeitada, perdeu a validade...). */
  private decisao({ data: p, origin }: FetchResult<SenadoProcesso>): Emission {
    const d = p.deliberacao ?? {};
    const outcome = senadoOutcome(d.siglaTipo);
    const veioDaCamara = p.siglaCasaIniciadora === 'CD' || p.objetivo === 'Revisora';
    return this.emit(DATASET, origin, {
      kind: 'event',
      id: `senado-deliberacao:${p.id}:${d.data}`,
      occurredAt: d.data!,
      title: d.tipoDeliberacao ?? 'Decisão do Senado',
      category: 'decisao-final',
      outcome,
      subject: this.subject(p),
      // Perder a validade não é decisão de ninguém: o prazo acabou sem votação.
      decidedBy: outcome === 'perdeu-validade' ? undefined : 'senado',
      links: this.links(p),
      attributes: {
        idProcesso: p.id,
        deliberacao: d.siglaTipo ?? null,
        destino: d.siglaDestino ?? null,
        origem: veioDaCamara ? 'camara' : p.sigla === 'MPV' ? 'presidencia' : 'senado',
      },
    });
  }

  /** Uma votação nominal (cada senador registra o voto). */
  private votacao(v: VotacaoNominal, p: SenadoProcesso | undefined, origin: Emission['origin']): Emission {
    const conta = (s: string) => v.votos?.filter((x) => x.siglaVotoParlamentar === s).length ?? 0;
    const sim = conta('Sim');
    const nao = conta('Não');
    const secreta = v.votacaoSecreta === 'S';
    return this.emit(DATASET, origin, {
      kind: 'event',
      id: `senado-votacao:${v.codigoSessaoVotacao}`,
      occurredAt: v.dataSessao,
      title: v.descricaoVotacao,
      summary: secreta || !v.votos?.length ? undefined : `${sim} senadores votaram Sim e ${nao} votaram Não.`,
      category: 'votacao-nominal',
      outcome: v.resultadoVotacao === 'A' ? 'aprovada' : v.resultadoVotacao === 'R' ? 'rejeitada' : undefined,
      subject: p
        ? this.subject(p)
        : { id: `senado-processo:${v.idProcesso}`, kind: v.sigla, label: v.identificacao, title: v.identificacao },
      decidedBy: 'senado',
      links: p ? this.links(p) : [],
      attributes: { idProcesso: v.idProcesso, codigoSessaoVotacao: v.codigoSessaoVotacao, sim, nao, secreta },
    });
  }
}

export default new SenadoProcessor();
