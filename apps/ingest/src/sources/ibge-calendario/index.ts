import type { DatasetDescriptor } from '@sb/core';
import { BaseProcessor, type Emission } from '../../framework/BaseProcessor.ts';
import type { RunContext } from '../../framework/Processor.ts';

const API = 'https://servicodados.ibge.gov.br/api/v3/calendario/';
const DATASET = 'ibge-divulgacoes';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

interface Divulgacao {
  id: number;
  titulo: string;
  /** "12/11/2026 12:00:00" */
  data_divulgacao: string;
  tipo: string;
  produto_id: number;
  nome_produto: string;
  ano_referencia_inicio: number | null;
  mes_referencia_inicio: number | null;
  ano_referencia_fim: number | null;
  mes_referencia_fim: number | null;
}

/** MM-DD-AAAA, formato que a API do calendário aceita em `de` e `ate`. */
const mdy = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;

/** "out/2026", "jul–set/2026": o período que a divulgação vai cobrir. */
function referencia(d: Divulgacao): string | undefined {
  const { ano_referencia_inicio: ai, mes_referencia_inicio: mi, ano_referencia_fim: af, mes_referencia_fim: mf } = d;
  if (!af) return undefined;
  if (!mf) return String(af);
  const fim = `${MESES[mf - 1]}/${af}`;
  if (!mi || (mi === mf && ai === af)) return fim;
  return ai === af ? `${MESES[mi - 1]}–${fim}` : `${MESES[mi - 1]}/${ai}–${fim}`;
}

/** Calendário de divulgações do IBGE: quando sai o próximo dado de cada pesquisa. */
class IbgeCalendarioProcessor extends BaseProcessor {
  constructor() {
    super(
      {
        id: 'ibge-calendario',
        name: 'IBGE – Calendário de divulgações',
        publisher: 'Instituto Brasileiro de Geografia e Estatística (IBGE)',
        homepage: 'https://www.ibge.gov.br/calendario-de-divulgacoes.html',
        docsUrl: 'https://servicodados.ibge.gov.br/api/docs/calendario?versao=3',
        license: 'Dados públicos; uso livre com citação da fonte (IBGE).',
        access: { method: 'api-rest', auth: 'nenhuma' },
        publishFrequency: 'irregular',
        coverage: { territorial: ['pais'], temporal: 'Do mês passado até 6 meses à frente.' },
        limitations: [
          'O IBGE pode adiar uma divulgação. A data vale como prevista na última coleta.',
          'As pesquisas anuais com vários temas (como a PNAD anual) não dizem no calendário qual tema sai em cada data; esses dados ficam sem "próxima atualização".',
        ],
      },
      '0.1.0',
    );
  }

  datasets(): DatasetDescriptor[] {
    return [
      this.describe({
        id: DATASET,
        title: 'Próximas divulgações do IBGE',
        kind: 'event',
        theme: 'referencia',
        frequency: 'irregular',
        explanation: {
          simple: 'As datas em que o IBGE vai publicar números novos, como a inflação do mês e o desemprego.',
          technical:
            'API de calendário do IBGE (/api/v3/calendario), de 30 dias atrás até 180 dias à frente. Cada divulgação traz o produto (produto_id), usado como chave para ligar a data ao indicador (campo nextRelease do indicador).',
        },
        view: { type: 'feed', options: {} },
        caveats: ['Datas previstas; o IBGE pode mudar.'],
        originDocs: 'https://www.ibge.gov.br/calendario-de-divulgacoes.html',
      }),
    ];
  }

  protected async *collect(ctx: RunContext): AsyncIterable<Emission> {
    const now = Date.now();
    const de = mdy(new Date(now - 30 * 86_400_000));
    const ate = mdy(new Date(now + 180 * 86_400_000));
    let page = 1;
    for (;;) {
      const res = await ctx.http.getJson<{ items: Divulgacao[]; nextPage: number; totalPages: number }>(
        `${API}?de=${de}&ate=${ate}&qtd=500&page=${page}`,
      );
      for (const d of res.data.items) {
        const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/.exec(d.data_divulgacao);
        if (!m) {
          ctx.issue(`divulgação ${d.id}: data em formato inesperado (${d.data_divulgacao})`);
          continue;
        }
        const ref = referencia(d);
        yield this.emit(DATASET, res.origin, {
          kind: 'event',
          id: `ibge-divulgacao:${d.id}`,
          // O horário da API é UTC (12:00 = 9h de Brasília).
          occurredAt: `${m[3]}-${m[2]}-${m[1]}T${m[4]}Z`,
          title: d.titulo,
          summary: ref ? `Dados de ${ref}.` : undefined,
          category: 'divulgacao',
          attributes: { chave: String(d.produto_id), produto: d.nome_produto, referencia: ref ?? null, tipo: d.tipo },
        });
      }
      if (page >= res.data.totalPages) break;
      page++;
    }
  }
}

export default new IbgeCalendarioProcessor();
