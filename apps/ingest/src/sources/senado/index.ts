import type { DatasetDescriptor, EventSubject } from '@sb/core';
import { BaseProcessor, type Emission } from '../../framework/BaseProcessor.ts';
import type { FetchResult } from '../../framework/HttpClient.ts';
import type { RunContext } from '../../framework/Processor.ts';
import { SENADO_API, getProcesso, senadoPage } from './api.ts';
import { senadoOutcome, senadoStatus, type SenadoProcesso } from './status.ts';

const DATASET = 'senado-plenario';

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
        ],
      },
      '0.1.0',
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
