import type { DatasetDescriptor, DatasetDescriptorInput } from '@sb/core';
import { BaseProcessor, type Emission } from '../../framework/BaseProcessor.ts';
import type { RunContext } from '../../framework/Processor.ts';

const SGS = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const FOCUS = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata';

type Descriptor = Omit<DatasetDescriptorInput, 'sourceId' | 'kind'>;

/** Um ponto por dia, como a origem publica. */
interface Diario {
  date: string; // ISO
  value: number;
}

/**
 * Séries diárias viram um ponto por mês: o último dia com dado. O mês corrente fica com o dado mais recente
 * (o rótulo é a data exata, para não parecer média do mês).
 */
function ultimoDeCadaMes(points: Diario[]): Diario[] {
  const byMonth = new Map<string, Diario>();
  for (const p of points.sort((a, b) => a.date.localeCompare(b.date))) byMonth.set(p.date.slice(0, 7), p);
  return [...byMonth.values()];
}

const brDate = (iso: string) => iso.split('-').reverse().join('/');
const isoFromBr = (br: string) => br.split('/').reverse().join('-');

const DATASETS: Descriptor[] = [
  {
    id: 'selic',
    title: 'Juros básicos (Selic)',
    theme: 'economia',
    unit: '%',
    decimals: 2,
    frequency: 'irregular',
    polarity: 'neutro',
    explanation: {
      simple:
        'É a taxa de juros que o Banco Central define para o país. Ela serve de base para os juros de empréstimos, financiamentos e cartão, e também para o que rende a poupança e outros investimentos. Juros altos seguram os preços, mas deixam o crédito mais caro.',
      technical:
        'Meta para a taxa Selic definida pelo Comitê de Política Monetária (Copom), em % ao ano. Série 432 do Sistema Gerenciador de Séries Temporais (SGS) do Banco Central. Um ponto por mês: o valor em vigor no último dia com dado do mês.',
    },
    view: { type: 'timeseries', options: {} },
    caveats: [
      'A Selic é a base. Os juros cobrados das pessoas (cartão, cheque especial, crediário) são bem mais altos.',
      'A Selic só muda nas reuniões do Copom, cerca de 8 por ano. Entre uma reunião e outra o número fica igual.',
    ],
    featured: false,
    summary: { template: 'Os juros básicos do país estão em {value} ao ano.' },
    readWith: [
      {
        datasetId: 'ipca-12-meses',
        why: 'Juros só pesam de verdade quando estão acima da inflação. Olhe os dois juntos.',
      },
      {
        datasetId: 'inflacao-esperada',
        why: 'O Banco Central decide os juros olhando para a inflação que vem pela frente, não só a do passado.',
      },
    ],
    originDocs: 'https://www.bcb.gov.br/controleinflacao/taxaselic',
  },
  {
    id: 'dolar',
    title: 'Preço do dólar',
    theme: 'economia',
    unit: 'reais',
    decimals: 2,
    frequency: 'diaria',
    polarity: 'neutro',
    explanation: {
      simple:
        'Quantos reais custa um dólar americano. Quando o dólar sobe, ficam mais caros produtos importados e coisas que dependem dele, como combustível, trigo (pão, massas) e eletrônicos.',
      technical:
        'Taxa de câmbio PTAX de venda (R$/US$), calculada pelo Banco Central a partir das cotações do mercado. Série 1 do SGS. Um ponto por mês: a cotação do último dia útil com dado do mês.',
    },
    view: { type: 'timeseries', options: {} },
    caveats: [
      'É a cotação usada como referência pelo mercado. Quem compra dólar em espécie numa casa de câmbio paga mais.',
      'O dólar muda todo dia. O gráfico mostra um dia por mês (o último), não a média do mês.',
    ],
    summary: { template: 'Em {period}, um dólar custava {value}.' },
    readWith: [
      {
        datasetId: 'ipca-12-meses',
        why: 'Dólar alto empurra parte dos preços para cima, mas não sozinho. A inflação mostra o efeito no bolso.',
      },
    ],
    originDocs: 'https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes',
  },
  {
    id: 'inflacao-esperada',
    title: 'Inflação esperada para os próximos 12 meses',
    theme: 'economia',
    unit: '%',
    decimals: 2,
    frequency: 'diaria',
    polarity: 'neutro',
    explanation: {
      simple:
        'Quanto bancos, corretoras e consultorias acham que os preços vão subir nos próximos 12 meses. O Banco Central faz essa pergunta toda semana (pesquisa Focus). É uma aposta, não um fato: serve para ver se quem acompanha a economia espera preços subindo mais rápido ou mais devagar.',
      technical:
        'Mediana das expectativas para o IPCA acumulado nos 12 meses seguintes, série suavizada, considerando todas as respostas (baseCalculo = 0). Sistema de Expectativas de Mercado (Focus) do Banco Central, recurso ExpectativasMercadoInflacao12Meses da API Olinda. Um ponto por mês: o último dia com dado do mês.',
    },
    view: {
      type: 'timeseries',
      options: { referenceLines: [{ value: 3, label: 'Meta atual: 3%' }] },
    },
    caveats: [
      'É opinião de especialistas do mercado financeiro, não previsão oficial do governo nem do Banco Central.',
      'Essas expectativas já erraram muito, para cima e para baixo. Compare com a inflação que de fato aconteceu.',
    ],
    summary: {
      template: 'Quem acompanha o mercado espera que os preços subam {value} nos próximos 12 meses.',
      bands: [
        { min: 1.5, max: 4.5, text: 'Está dentro da faixa da meta oficial (de 1,5% a 4,5%).' },
        { max: 1.5, text: 'Está abaixo do piso da meta oficial (1,5%).' },
        { min: 4.5, text: 'Está acima do teto da meta oficial (4,5%).' },
      ],
    },
    readWith: [
      { datasetId: 'ipca-12-meses', why: 'A expectativa é uma aposta. A inflação medida pelo IBGE é o que de fato aconteceu.' },
    ],
    originDocs: 'https://www.bcb.gov.br/publicacoes/focus',
  },
];

/** Juros, dólar e expectativas de inflação do Banco Central do Brasil. */
class BcbProcessor extends BaseProcessor {
  private readonly descriptors: DatasetDescriptor[];

  constructor() {
    super(
      {
        id: 'bcb',
        name: 'Banco Central do Brasil – SGS e Focus',
        publisher: 'Banco Central do Brasil',
        homepage: 'https://dadosabertos.bcb.gov.br/',
        docsUrl: 'https://dadosabertos.bcb.gov.br/dataset/sgs-sistema-gerenciador-de-series-temporais',
        license: 'Dados abertos do Banco Central; uso livre com citação da fonte.',
        access: {
          method: 'api-rest',
          auth: 'nenhuma',
          notes: 'Séries diárias do SGS aceitam no máximo 10 anos por consulta.',
        },
        publishFrequency: 'diaria',
        coverage: { territorial: ['pais'], temporal: 'Últimos 10 anos (Selic, dólar e expectativas).' },
        limitations: [
          'Os dados são diários, mas a coleta guarda um ponto por mês (o último dia com dado).',
          'Só o país inteiro: juros e dólar são os mesmos em todos os estados.',
        ],
      },
      '0.1.0',
    );
    this.descriptors = DATASETS.map((d) => this.describe({ ...d, kind: 'observation' }));
  }

  datasets(): DatasetDescriptor[] {
    return this.descriptors;
  }

  protected async *collect(ctx: RunContext): AsyncIterable<Emission> {
    const hoje = new Date().toISOString().slice(0, 10);
    // Janela de 10 anos menos um dia (limite do SGS para séries diárias).
    const inicio = new Date(Date.now() - (10 * 365 + 1) * 86_400_000).toISOString().slice(0, 10);

    const sgs: [string, number][] = [
      ['selic', 432],
      ['dolar', 1],
    ];
    for (const [datasetId, codigo] of sgs) {
      try {
        const res = await ctx.http.getJson<{ data: string; valor: string }[]>(
          `${SGS}.${codigo}/dados?formato=json&dataInicial=${brDate(inicio)}&dataFinal=${brDate(hoje)}`,
        );
        // A meta da Selic vem preenchida até a próxima reunião do Copom: dias futuros ficam de fora.
        const diarios = res.data
          .map((p) => ({ date: isoFromBr(p.data), value: Number(p.valor) }))
          .filter((p) => p.date <= hoje && Number.isFinite(p.value));
        yield* this.mensal(datasetId, ultimoDeCadaMes(diarios), res.origin, { serieSgs: String(codigo) });
      } catch (err) {
        ctx.issue(`${datasetId}: ${(err as Error).message}`);
      }
    }

    try {
      const filtro = `Indicador eq 'IPCA' and Suavizada eq 'S' and baseCalculo eq 0 and Data ge '${inicio}'`;
      // OData: o "$" dos parâmetros não pode ser codificado e espaço vai como %20 (o "+" dá erro 400).
      const params = Object.entries({ $filter: filtro, $select: 'Data,Mediana', $orderby: 'Data', $top: '10000', $format: 'json' })
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
      const res = await ctx.http.getJson<{ value: { Data: string; Mediana: number }[] }>(
        `${FOCUS}/ExpectativasMercadoInflacao12Meses?${params}`,
      );
      const diarios = res.data.value.map((p) => ({ date: p.Data, value: p.Mediana }));
      yield* this.mensal('inflacao-esperada', ultimoDeCadaMes(diarios), res.origin, { pesquisa: 'Focus' });
    } catch (err) {
      ctx.issue(`inflacao-esperada: ${(err as Error).message}`);
    }
  }

  private *mensal(datasetId: string, points: Diario[], origin: Emission['origin'], dims: Record<string, string>): Iterable<Emission> {
    for (const p of points) {
      yield this.emit(datasetId, origin, {
        kind: 'observation',
        // Um id por mês: o ponto do mês corrente é atualizado a cada coleta.
        id: `${datasetId}:pais:1:${p.date.slice(0, 7)}`,
        period: { start: p.date, end: p.date, label: brDate(p.date) },
        territory: { level: 'pais', code: '1', name: 'Brasil' },
        value: p.value,
        dimensions: { ...dims, dataReferencia: p.date },
      });
    }
  }
}

export default new BcbProcessor();
