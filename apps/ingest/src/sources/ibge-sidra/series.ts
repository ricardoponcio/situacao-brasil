/**
 * Séries do SIDRA coletadas. Para adicionar um indicador do IBGE, acrescente um item aqui:
 * descubra agregado/variável em https://sidra.ibge.gov.br (ou na API /api/v3/agregados/{id}/metadados).
 */
import type { SidraSeries } from './SidraProcessor.ts';

const PNAD_ANUAL =
  'https://www.ibge.gov.br/estatisticas/sociais/trabalho/17270-pnad-continua.html';

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

  // ── Necessidades básicas (PNAD Contínua anual) ────────────────────────────────────────────
  // Percentuais de MORADORES (pessoas), não de domicílios: "de cada 100 pessoas" é mais fácil de ler.
  {
    agregado: 9552,
    variavel: 10117,
    classificacao: '1[6795]|12404[109102]',
    periodos: 'all',
    niveis: ['N1', 'N3'],
    periodType: 'ano',
    descriptor: {
      id: 'inseguranca-alimentar-grave',
      title: 'Fome (insegurança alimentar grave)',
      theme: 'condicoes-de-vida',
      layer: 'necessidades-basicas',
      unit: '%',
      decimals: 1,
      frequency: 'anual',
      polarity: 'menor-melhor',
      explanation: {
        simple:
          'De cada 100 pessoas, quantas moram numa casa onde faltou comida nos últimos 3 meses: os adultos, e às vezes as crianças, ficaram sem comer ou passaram um dia inteiro sem comer por falta de dinheiro.',
        technical:
          'Percentual de moradores em domicílios particulares com insegurança alimentar grave, medida pela Escala Brasileira de Insegurança Alimentar (EBIA), com referência aos 3 meses anteriores à entrevista. PNAD Contínua, tabela SIDRA 9552, variável 10117, situação do domicílio = Total.',
      },
      view: { type: 'timeseries', options: { headline: true } },
      caveats: [
        'A pergunta é sobre os 3 meses antes da entrevista, e a resposta é de quem mora na casa (não é medição de peso ou de nutrição).',
        'A série na PNAD Contínua começa em 2023. Pesquisas anteriores (PNAD 2004, 2009, 2013 e POF 2017-2018) usaram a mesma escala, mas outra amostra; por isso não estão juntas aqui.',
        'É pesquisa por amostra: diferenças pequenas de um ano para outro podem estar dentro da margem de erro.',
      ],
      featured: true,
      summary: {
        template: 'Cerca de {round} em cada 100 pessoas moram numa casa onde faltou comida.',
        compareHistory: false,
      },
      readWith: [
        {
          datasetId: 'inseguranca-alimentar',
          why: 'A fome é o nível mais grave. Muito mais gente vive com medo de a comida acabar ou comendo menos do que precisa.',
        },
      ],
      originDocs: PNAD_ANUAL,
    },
  },
  {
    agregado: 9552,
    variavel: 10117,
    classificacao: '1[6795]|12404[109099]',
    periodos: 'all',
    niveis: ['N1', 'N3'],
    periodType: 'ano',
    descriptor: {
      id: 'inseguranca-alimentar',
      title: 'Insegurança alimentar (todos os níveis)',
      theme: 'condicoes-de-vida',
      layer: 'necessidades-basicas',
      unit: '%',
      decimals: 1,
      frequency: 'anual',
      polarity: 'menor-melhor',
      explanation: {
        simple:
          'De cada 100 pessoas, quantas moram numa casa onde a comida não estava garantida. Junta três níveis: leve (medo de a comida acabar, ou comer pior para economizar), moderado (os adultos comeram menos) e grave (faltou comida).',
        technical:
          'Percentual de moradores em domicílios particulares com insegurança alimentar leve, moderada ou grave, pela Escala Brasileira de Insegurança Alimentar (EBIA), referência de 3 meses. PNAD Contínua, tabela SIDRA 9552, variável 10117, categoria "Com insegurança alimentar".',
      },
      view: { type: 'timeseries', options: {} },
      caveats: [
        'A série na PNAD Contínua começa em 2023.',
        'É pesquisa por amostra: diferenças pequenas de um ano para outro podem estar dentro da margem de erro.',
      ],
      summary: {
        template:
          'Somando todos os níveis, cerca de {round} em cada 100 pessoas moram numa casa onde a comida não estava garantida.',
        compareHistory: false,
      },
      readWith: [{ datasetId: 'inseguranca-alimentar-grave', why: 'É a parte mais grave desta conta: onde faltou comida.' }],
      originDocs: PNAD_ANUAL,
    },
  },
  {
    agregado: 6731,
    variavel: 10117,
    classificacao: '1[6795]|825[46285]',
    periodos: 'all',
    niveis: ['N1', 'N3'],
    periodType: 'ano',
    descriptor: {
      id: 'agua-rede-geral',
      title: 'Água encanada da rede',
      theme: 'condicoes-de-vida',
      layer: 'necessidades-basicas',
      unit: '%',
      decimals: 1,
      frequency: 'anual',
      polarity: 'maior-melhor',
      explanation: {
        simple:
          'De cada 100 pessoas, quantas recebem água principalmente pela rede de distribuição (a água da companhia, que chega pelo cano). As outras usam poço, nascente, cisterna, caminhão-pipa ou outras formas.',
        technical:
          'Percentual de moradores em domicílios particulares permanentes cuja principal fonte de abastecimento de água é a rede geral de distribuição. PNAD Contínua anual (visita 1), tabela SIDRA 6731, variável 10117, situação do domicílio = Total.',
      },
      view: { type: 'timeseries', options: {} },
      caveats: [
        'Não ter rede não quer dizer não ter água boa: no campo, poço profundo é comum e pode ser adequado.',
        'Ter rede não quer dizer que a água chega todo dia. Veja o indicador ao lado.',
        'É pesquisa por amostra: diferenças pequenas de um ano para outro podem estar dentro da margem de erro.',
        'Não há dado de 2020 e 2021: o IBGE não divulgou este tema nesses anos, quando a coleta foi feita por telefone por causa da pandemia.',
      ],
      summary: {
        template: 'Cerca de {round} em cada 100 pessoas recebem água principalmente pela rede de distribuição.',
        compareHistory: false,
      },
      readWith: [{ datasetId: 'agua-todo-dia', why: 'Ter o cano da rede não garante que a água chega todos os dias.' }],
      originDocs: PNAD_ANUAL,
    },
  },
  {
    agregado: 6732,
    variavel: 10121,
    classificacao: '1[6795]|826[46293]',
    periodos: 'all',
    niveis: ['N1', 'N3'],
    periodType: 'ano',
    descriptor: {
      id: 'agua-todo-dia',
      title: 'Água da rede todos os dias',
      theme: 'condicoes-de-vida',
      layer: 'necessidades-basicas',
      unit: '%',
      decimals: 1,
      frequency: 'anual',
      polarity: 'maior-melhor',
      explanation: {
        simple:
          'Entre as pessoas que recebem água pela rede, de cada 100, quantas têm água chegando todos os dias. As outras ficam sem água em parte da semana.',
        technical:
          'Percentual de moradores em domicílios cuja principal forma de abastecimento é a rede geral e cuja disponibilidade da rede é diária. PNAD Contínua anual, tabela SIDRA 6732, variável 10121, situação do domicílio = Total.',
      },
      view: { type: 'timeseries', options: {} },
      caveats: [
        'A conta é só entre quem recebe água pela rede. Quem não tem rede não entra.',
        'É pesquisa por amostra: diferenças pequenas de um ano para outro podem estar dentro da margem de erro.',
        'Não há dado de 2020 e 2021 (na pandemia o IBGE não divulgou este tema).',
        'A diferença entre os estados é grande. Os números por estado já são coletados e vão aparecer num mapa.',
      ],
      summary: {
        template: 'Entre quem recebe água da rede, cerca de {round} em cada 100 têm água todos os dias.',
        compareHistory: false,
      },
      readWith: [{ datasetId: 'agua-rede-geral', why: 'Mostra quantas pessoas têm a rede de água em primeiro lugar.' }],
      originDocs: PNAD_ANUAL,
    },
  },
  {
    agregado: 7192,
    variavel: 10133,
    classificacao: '1[6795]|11558[47930,47931]',
    somarCategorias: true,
    periodos: 'all',
    niveis: ['N1', 'N3'],
    periodType: 'ano',
    descriptor: {
      id: 'esgoto-rede',
      title: 'Esgoto ligado à rede',
      theme: 'condicoes-de-vida',
      layer: 'necessidades-basicas',
      unit: '%',
      decimals: 1,
      frequency: 'anual',
      polarity: 'maior-melhor',
      explanation: {
        simple:
          'De cada 100 pessoas, quantas moram em casas com o esgoto ligado à rede (o cano da rua). As outras usam fossa, vala, ou o esgoto vai direto para rio ou terreno.',
        technical:
          'Percentual de moradores em domicílios com banheiro, sanitário ou buraco para dejeções cujo esgotamento é por "rede geral ou rede pluvial" somado a "fossa séptica ligada à rede". PNAD Contínua anual, tabela SIDRA 7192, variável 10133, situação do domicílio = Total.',
      },
      view: { type: 'timeseries', options: {} },
      caveats: [
        'Estar ligado à rede não quer dizer que o esgoto é tratado depois: isso a PNAD não pergunta.',
        'É pesquisa por amostra: diferenças pequenas de um ano para outro podem estar dentro da margem de erro.',
        'Fossa séptica não ligada à rede pode ser adequada, principalmente no campo. Ela não entra nesta conta.',
        'A conta é entre quem mora em casa com banheiro, sanitário ou buraco para dejeções (quase todo mundo).',
        'A série começa em 2019 e não há dado de 2020 e 2021 (na pandemia o IBGE não divulgou este tema).',
      ],
      summary: {
        template: 'Cerca de {round} em cada 100 pessoas moram em casas com o esgoto ligado à rede.',
        compareHistory: false,
      },
      originDocs: PNAD_ANUAL,
    },
  },
];
