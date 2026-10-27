/**
 * Séries do SIDRA coletadas. Para adicionar um indicador do IBGE, acrescente um item aqui:
 * descubra agregado/variável em https://sidra.ibge.gov.br (ou na API /api/v3/agregados/{id}/metadados).
 */
import type { SidraSeries } from './SidraProcessor.ts';

export const SERIES: SidraSeries[] = [
  {
    agregado: 1737,
    variavel: 2265,
    periodos: '-120',
    niveis: ['N1'],
    periodType: 'mes',
    descriptor: {
      id: 'ipca-12-meses',
      title: 'Inflação dos últimos 12 meses (IPCA)',
      theme: 'economia',
      unit: '%',
      decimals: 2,
      frequency: 'mensal',
      polarity: 'neutro',
      explanation: {
        simple:
          'Mostra quanto os preços subiram, em média, nos últimos 12 meses. Se o número é 4,5%, algo que custava R$ 100 há um ano hoje custa por volta de R$ 104,50.',
        technical:
          'Variação acumulada em 12 meses do Índice Nacional de Preços ao Consumidor Amplo (IPCA), tabela SIDRA 1737, variável 2265. Cesta de famílias com renda de 1 a 40 salários mínimos, nas regiões metropolitanas e capitais pesquisadas pelo IBGE.',
      },
      view: {
        type: 'timeseries',
        options: { headline: true, referenceLines: [{ value: 3, label: 'Meta atual: 3%' }] },
      },
      caveats: [
        'A meta oficial de inflação, definida pelo Conselho Monetário Nacional, é 3% ao ano, com tolerância de 1,5 ponto para cima ou para baixo.',
        'A meta mudou ao longo do tempo (era 4,5% em 2018, por exemplo). A linha no gráfico mostra só a meta atual.',
        'É uma média: a inflação de cada família depende do que ela consome (alimentos, aluguel, transporte...).',
      ],
      featured: true,
      summary: {
        template: 'Em 12 meses, os preços {sign} {abs} em média.',
        signWords: { up: 'subiram', down: 'caíram', flat: 'ficaram praticamente iguais' },
        bands: [
          { min: 1.5, max: 4.5, text: 'Está dentro da faixa da meta oficial (de 1,5% a 4,5%).' },
          { max: 1.5, text: 'Está abaixo do piso da meta oficial (1,5%).' },
          { min: 4.5, text: 'Está acima do teto da meta oficial (4,5%).' },
        ],
      },
      originDocs: 'https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor-amplo.html',
    },
  },
  {
    agregado: 1737,
    variavel: 63,
    periodos: '-120',
    niveis: ['N1'],
    periodType: 'mes',
    descriptor: {
      id: 'ipca-mensal',
      title: 'Inflação do mês (IPCA)',
      theme: 'economia',
      unit: '%',
      decimals: 2,
      frequency: 'mensal',
      polarity: 'neutro',
      explanation: {
        simple:
          'Quanto os preços mudaram de um mês para o outro. Número negativo quer dizer que, em média, as coisas ficaram mais baratas naquele mês.',
        technical: 'Variação mensal do IPCA, tabela SIDRA 1737, variável 63.',
      },
      view: { type: 'timeseries', options: {} },
      caveats: ['Um mês isolado oscila muito (energia, combustível, alimentos). Para tendência, olhe o acumulado em 12 meses.'],
      summary: {
        template: 'Em {period}, os preços {sign} {abs} em relação ao mês anterior.',
        signWords: { up: 'subiram', down: 'caíram', flat: 'ficaram praticamente iguais' },
        compareHistory: false,
      },
      originDocs: 'https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor-amplo.html',
    },
  },
  {
    agregado: 6381,
    variavel: 4099,
    periodos: '-120',
    niveis: ['N1'],
    periodType: 'trimestre-movel',
    descriptor: {
      id: 'desocupacao',
      title: 'Desemprego (taxa de desocupação)',
      theme: 'trabalho',
      unit: '%',
      decimals: 1,
      frequency: 'mensal',
      polarity: 'menor-melhor',
      explanation: {
        simple:
          'De cada 100 pessoas que querem trabalhar e estão procurando emprego, quantas não conseguiram. Quem desistiu de procurar não entra nessa conta.',
        technical:
          'Taxa de desocupação das pessoas de 14 anos ou mais na semana de referência, PNAD Contínua, trimestre móvel. Tabela SIDRA 6381, variável 4099.',
      },
      view: { type: 'timeseries', options: { headline: true } },
      caveats: [
        'Cada ponto é a média de 3 meses (trimestre móvel), por isso a taxa reage devagar.',
        'Não mostra a qualidade do trabalho (informalidade, renda). Isso vai entrar como indicador separado.',
        'Existe sazonalidade: o desemprego costuma subir no começo do ano.',
      ],
      featured: true,
      summary: {
        template: 'De cada 100 pessoas procurando trabalho, cerca de {round} não encontram.',
      },
      readWith: [
        {
          datasetId: 'subutilizacao',
          why: 'O desemprego não conta quem trabalha menos horas do que precisa, nem quem desistiu de procurar.',
        },
        {
          datasetId: 'informalidade',
          why: 'Quem trabalha sem carteira ou sem CNPJ conta como empregado, mas sem férias, INSS ou FGTS.',
        },
      ],
      originDocs: 'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9171-pesquisa-nacional-por-amostra-de-domicilios-continua-mensal.html',
    },
  },
  {
    agregado: 6441,
    variavel: 4118,
    periodos: '-120',
    niveis: ['N1'],
    periodType: 'trimestre-movel',
    descriptor: {
      id: 'subutilizacao',
      title: 'Subutilização (desemprego ampliado)',
      theme: 'trabalho',
      unit: '%',
      decimals: 1,
      frequency: 'mensal',
      polarity: 'menor-melhor',
      explanation: {
        simple:
          'Uma conta mais completa que a do desemprego. Junta três grupos: quem procura emprego e não acha, quem trabalha menos horas do que gostaria e quem queria trabalhar mas não procurou (por exemplo, porque desistiu).',
        technical:
          'Taxa composta de subutilização da força de trabalho: (desocupados + subocupados por insuficiência de horas + força de trabalho potencial) ÷ força de trabalho ampliada. PNAD Contínua, trimestre móvel. Tabela SIDRA 6441, variável 4118.',
      },
      view: { type: 'timeseries', options: {} },
      caveats: [
        'O denominador é maior que o do desemprego (inclui a força de trabalho potencial), então as duas taxas não se somam.',
        'Cada ponto é a média de 3 meses (trimestre móvel).',
      ],
      summary: {
        template:
          'Somando quem trabalha menos horas do que gostaria e quem desistiu de procurar, são cerca de {round} em cada 100 pessoas que trabalham ou querem trabalhar.',
      },
      readWith: [{ datasetId: 'desocupacao', why: 'É a parte mais conhecida desta conta: quem procura e não encontra.' }],
      originDocs: 'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9171-pesquisa-nacional-por-amostra-de-domicilios-continua-mensal.html',
    },
  },
  {
    agregado: 8513,
    variavel: 12466,
    periodos: '-120',
    niveis: ['N1'],
    periodType: 'trimestre-movel',
    descriptor: {
      id: 'informalidade',
      title: 'Trabalho informal',
      theme: 'trabalho',
      unit: '%',
      decimals: 1,
      frequency: 'mensal',
      polarity: 'menor-melhor',
      explanation: {
        simple:
          'De cada 100 pessoas trabalhando, quantas estão na informalidade: sem carteira assinada, sem CNPJ, ou ajudando a família sem receber.',
        technical:
          'Taxa de informalidade das pessoas ocupadas: empregados sem carteira (setor privado e doméstico), empregadores e conta própria sem CNPJ e trabalhadores familiares auxiliares, sobre o total de ocupados. PNAD Contínua, trimestre móvel. Tabela SIDRA 8513, variável 12466 (série desde o fim de 2015).',
      },
      view: { type: 'timeseries', options: {} },
      caveats: [
        'Informal não quer dizer ilegal: muitos trabalham por conta própria sem CNPJ.',
        'Cada ponto é a média de 3 meses (trimestre móvel).',
      ],
      summary: {
        template: 'De cada 100 pessoas trabalhando, cerca de {round} estão na informalidade.',
      },
      readWith: [{ datasetId: 'desocupacao', why: 'Mostra quantos procuram trabalho e não encontram.' }],
      originDocs: 'https://www.ibge.gov.br/estatisticas/sociais/trabalho/9171-pesquisa-nacional-por-amostra-de-domicilios-continua-mensal.html',
    },
  },
];
