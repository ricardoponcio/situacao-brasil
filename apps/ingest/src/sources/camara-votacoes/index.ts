import type { DatasetDescriptor, SubjectStatus } from '@sb/core';
import { BaseProcessor, type Emission } from '../../framework/BaseProcessor.ts';
import type { FetchResult } from '../../framework/HttpClient.ts';
import type { RunContext } from '../../framework/Processor.ts';
import { camaraStatus, destinoFromDespacho, type Destino } from './status.ts';

const API = 'https://dadosabertos.camara.leg.br/api/v2';
const PLENARIO = 180;
const DATASET = 'camara-votacoes-plenario';

interface VotacaoResumo {
  id: string;
  uri: string;
  data: string;
  dataHoraRegistro: string;
  siglaOrgao: string;
  uriEvento: string | null;
  descricao: string;
  aprovacao: number | null;
}

interface ProposicaoResumo {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
}

interface VotacaoDetalhe {
  proposicoesAfetadas?: ProposicaoResumo[];
}

interface ProposicaoDetalhe {
  siglaTipo: string;
  statusProposicao: {
    dataHora: string;
    siglaOrgao: string;
    codSituacao: number;
    descricaoSituacao: string;
  };
}

interface Tramitacao {
  sequencia: number;
  despacho: string | null;
}

interface Page<T> {
  dados: T[];
  links: { rel: string; href: string }[];
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Votações do Plenário da Câmara dos Deputados (eventos). */
class CamaraVotacoesProcessor extends BaseProcessor {
  constructor() {
    super(
      {
        id: 'camara-votacoes',
        name: 'Câmara dos Deputados – Votações',
        publisher: 'Câmara dos Deputados',
        homepage: 'https://dadosabertos.camara.leg.br/',
        docsUrl: 'https://dadosabertos.camara.leg.br/swagger/api.html',
        license: 'Dados abertos da Câmara dos Deputados; uso livre com citação da fonte.',
        access: { method: 'api-rest', auth: 'nenhuma' },
        publishFrequency: 'tempo-real',
        coverage: { territorial: ['pais'], temporal: 'Votações registradas no sistema (anos 2000 em diante).' },
        limitations: [
          'Votações simbólicas registram só o resultado, não o voto de cada deputado.',
          'A descrição é o texto técnico do sistema da Câmara; a versão em linguagem simples ainda não existe.',
          'Uma mesma proposta passa por várias votações (requerimentos, emendas, texto final).',
          'A situação atual ("agora" e "próximo passo") vem do sistema da Câmara. Depois que a proposta vai ao Senado, ela só é atualizada quando o Senado devolve o texto ou a Câmara registra o resultado.',
        ],
      },
      '0.2.0',
    );
  }

  datasets(): DatasetDescriptor[] {
    return [
      this.describe({
        id: DATASET,
        title: 'Votações no Plenário da Câmara',
        kind: 'event',
        theme: 'politica',
        frequency: 'tempo-real',
        explanation: {
          simple:
            'Tudo o que foi colocado em votação no Plenário da Câmara, onde todos os 513 deputados podem votar. Para cada proposta, mostra em que passo ela está agora e o que ainda falta: aprovar na Câmara nem sempre quer dizer que virou lei.',
          technical:
            'Endpoint /votacoes da API de Dados Abertos da Câmara, filtrado por idOrgao=180 (Plenário). Inclui votações nominais e simbólicas, de proposições principais e acessórias (requerimentos, emendas, destaques). A situação atual de cada proposição vem de /proposicoes/{id} (statusProposicao) e o destino depois do Plenário, do último despacho "A matéria vai ao/à ..." em /proposicoes/{id}/tramitacoes.',
        },
        view: { type: 'feed', options: { groupBySubject: true } },
        caveats: [
          'Nem toda votação é decisiva: muitas são de procedimento (por exemplo, pedido para adiar ou de urgência). Uma votação "aprovada" pode ser só desse tipo de pedido; o passo atual da proposta mostra onde ela realmente está.',
        ],
        featured: true,
        summary: {
          template: 'Nos últimos {days} dias, o Plenário da Câmara votou {subjects} propostas, em {count} votações.',
          windowDays: 30,
        },
        originDocs: 'https://dadosabertos.camara.leg.br/swagger/api.html#/Votacoes',
      }),
    ];
  }

  protected async *collect(ctx: RunContext): AsyncIterable<Emission> {
    const dias = Number(ctx.options.dias ?? 30);
    const end = new Date();
    let cursor = new Date(end.getTime() - dias * 86_400_000);
    // Situação de cada proposição, buscada uma vez por execução (várias votações por proposta).
    const statuses = new Map<number, Promise<SubjectStatus | undefined>>();
    const statusOf = (id: number) => {
      if (!statuses.has(id)) statuses.set(id, this.fetchStatus(ctx, id));
      return statuses.get(id)!;
    };

    // A API limita o intervalo de datas por consulta; usamos janelas de 30 dias.
    while (cursor < end) {
      const windowEnd = new Date(Math.min(cursor.getTime() + 29 * 86_400_000, end.getTime()));
      let url: string | undefined =
        `${API}/votacoes?idOrgao=${PLENARIO}&dataInicio=${isoDate(cursor)}&dataFim=${isoDate(windowEnd)}` +
        `&itens=200&ordem=DESC&ordenarPor=dataHoraRegistro`;

      while (url) {
        const res: FetchResult<Page<VotacaoResumo>> = await ctx.http.getJson<Page<VotacaoResumo>>(url);
        for (const v of res.data.dados) {
          // O detalhe traz a proposição principal (tipo + ementa). Se falhar, segue só com o resumo.
          let detail: FetchResult<{ dados: VotacaoDetalhe }> | undefined;
          try {
            detail = await ctx.http.getJson<{ dados: VotacaoDetalhe }>(v.uri);
          } catch (err) {
            ctx.issue(`detalhe da votação ${v.id}: ${(err as Error).message}`);
          }
          const p = detail?.data.dados.proposicoesAfetadas?.[0];
          const status = p ? await statusOf(p.id) : undefined;
          yield this.toEvent(v, detail?.data.dados, detail?.origin ?? res.origin, status);
        }
        url = res.data.links.find((l) => l.rel === 'next')?.href;
      }
      cursor = new Date(windowEnd.getTime() + 86_400_000);
    }
  }

  /** Situação atual da proposição. Se a consulta falhar, a votação segue sem ela. */
  private async fetchStatus(ctx: RunContext, id: number): Promise<SubjectStatus | undefined> {
    try {
      const { data } = await ctx.http.getJson<{ dados: ProposicaoDetalhe }>(`${API}/proposicoes/${id}`);
      const { siglaTipo, statusProposicao: s } = data.dados;
      const tram = await ctx.http.getJson<{ dados: Tramitacao[] }>(`${API}/proposicoes/${id}/tramitacoes`);
      // O despacho mais recente que diz para onde o texto vai depois do Plenário.
      let destino: Destino | undefined;
      for (const t of [...tram.data.dados].sort((a, b) => b.sequencia - a.sequencia)) {
        destino = t.despacho ? destinoFromDespacho(t.despacho) : undefined;
        if (destino) break;
      }
      return camaraStatus({ siglaTipo, ...s, destino });
    } catch (err) {
      ctx.issue(`situação da proposição ${id}: ${(err as Error).message}`);
      return undefined;
    }
  }

  private toEvent(
    v: VotacaoResumo,
    d: VotacaoDetalhe | undefined,
    origin: Emission['origin'],
    status: SubjectStatus | undefined,
  ): Emission {
    // Proposição principal: a primeira "afetada" (o projeto em si, não emendas/pareceres).
    const p = d?.proposicoesAfetadas?.[0];
    const idEvento = v.uriEvento?.split('/').pop();
    const links = [{ label: 'Registro da votação (API da Câmara)', url: v.uri }];
    if (idEvento) links.push({ label: 'Sessão na Câmara', url: `https://www.camara.leg.br/evento-legislativo/${idEvento}` });
    if (p) links.push({ label: 'Situação atual da proposta (API da Câmara)', url: `${API}/proposicoes/${p.id}` });

    const subject = p
      ? {
          id: `camara-proposicao:${p.id}`,
          kind: p.siglaTipo,
          label: `${p.siglaTipo} ${p.numero.toLocaleString('pt-BR')}/${p.ano}`,
          title: p.ementa,
          url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
          status,
        }
      : undefined;

    return this.emit(DATASET, origin, {
      kind: 'event',
      id: `camara-votacao:${v.id}`,
      occurredAt: v.dataHoraRegistro ?? v.data,
      title: v.descricao,
      category: /requerimento/i.test(v.descricao) ? 'procedimento' : 'votacao-plenario',
      outcome: v.aprovacao === 1 ? 'aprovada' : v.aprovacao === 0 ? 'rejeitada' : undefined,
      subject,
      decidedBy: 'camara',
      links,
      attributes: { idVotacao: v.id, idEvento: idEvento ?? null, orgao: v.siglaOrgao },
    });
  }
}

export default new CamaraVotacoesProcessor();
