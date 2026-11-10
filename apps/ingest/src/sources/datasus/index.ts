/**
 * DATASUS (Ministério da Saúde): mortes (SIM), nascimentos (SINASC) e dengue (SINAN), pelo FTP público.
 *
 * Cada arquivo .dbc é baixado, lido na memória e vira contagens no banco (tabela `datasus_contagens`, por município,
 * ano, grupo, faixa de idade e sexo; a dengue também por mês). O arquivo não fica guardado, só a identidade dele
 * (endereço, data, sha256), exceto o preliminar mais recente, que a origem substitui e que por isso guardamos.
 * Arquivo cuja data e tamanho não mudaram não é baixado de novo.
 *
 * Opções (--opt): desde=2015 (primeiro ano), minutos=40 (tempo máximo baixando por coleta; o resto fica para a
 * próxima), sistemas=sim,sinasc,sinan-dengue.
 */
import type { DatasetDescriptor, DatasetDescriptorInput, RecordDraft, TerritoryLevel } from '@sb/core';
import type { DatasusArquivo } from '@sb/storage';
import { BaseProcessor, type Emission } from '../../framework/BaseProcessor.ts';
import type { Origin } from '../../framework/HttpClient.ts';
import type { RunContext } from '../../framework/Processor.ts';
import { agregar, type Sistema } from './agregar.ts';
import { lerDbc } from './dbc.ts';
import { DatasusFtp, type ArquivoRemoto } from './ftp.ts';
import { carregarPopulacao, type Populacao } from './populacao.ts';

/** Sigla → código IBGE. A região é o primeiro dígito do código. */
const UFS: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53',
};
const N_UFS = Object.keys(UFS).length;

interface Pasta {
  caminho: string;
  final: boolean;
  /** Extrai UF e ano do nome do arquivo; null = ignorar. */
  ler(nome: string): { uf: string; ano: number } | null;
}

const porUf = (prefixo: string) => (nome: string) => {
  const m = new RegExp(`^${prefixo}([A-Z]{2})(\\d{4})\\.dbc$`, 'i').exec(nome);
  return m && UFS[m[1]!.toUpperCase()] ? { uf: m[1]!.toUpperCase(), ano: Number(m[2]) } : null;
};
const dengue = (nome: string) => {
  const m = /^DENGBR(\d{2})\.dbc$/i.exec(nome);
  return m ? { uf: 'BR', ano: 2000 + Number(m[1]) } : null;
};

const PASTAS: Record<Sistema, Pasta[]> = {
  sim: [
    { caminho: 'SIM/CID10/DORES', final: true, ler: porUf('DO') },
    { caminho: 'SIM/PRELIM/DORES', final: false, ler: porUf('DO') },
  ],
  sinasc: [
    { caminho: 'SINASC/1996_/Dados/DNRES', final: true, ler: porUf('DN') },
    { caminho: 'SINASC/PRELIM/DNRES', final: false, ler: porUf('DN') },
  ],
  'sinan-dengue': [
    { caminho: 'SINAN/DADOS/FINAIS', final: true, ler: dengue },
    { caminho: 'SINAN/DADOS/PRELIM', final: false, ler: dengue },
  ],
};

interface Candidato extends ArquivoRemoto {
  sistema: Sistema;
  uf: string;
  ano: number;
  final: boolean;
}

type Descriptor = Omit<DatasetDescriptorInput, 'sourceId' | 'kind'>;

const SIM_DOCS = 'https://svs.aids.gov.br/daent/centrais-de-conteudos/dados-abertos/sim/';
const PRELIMINAR =
  'Os dois anos mais recentes são preliminares: o Ministério da Saúde ainda corrige e completa os registros, e o número costuma subir um pouco.';
const POPULACAO =
  'A população vem do IBGE. De 2015 a 2021 são estimativas feitas antes do Censo de 2022, que em alguns estados ficaram acima da população real; por isso a taxa desses anos pode estar um pouco abaixo da real. 2023 é calculado entre o Censo de 2022 e a estimativa de 2024.';

const DATASETS: Descriptor[] = [
  {
    id: 'homicidios',
    title: 'Assassinatos (taxa de homicídios)',
    theme: 'seguranca',
    layer: 'necessidades-basicas',
    unit: 'por 100 mil',
    decimals: 1,
    frequency: 'anual',
    polarity: 'menor-melhor',
    featured: true,
    territories: { levels: ['regiao', 'uf'] },
    explanation: {
      simple:
        'Quantas pessoas foram assassinadas no ano para cada 100 mil moradores. Usar "a cada 100 mil" deixa comparar estados grandes e pequenos. A conta vem das certidões de óbito, e não dos boletins de ocorrência da polícia.',
      technical:
        'Óbitos por agressão (CID-10 X85–Y09) e por intervenção legal (Y35–Y36), pela causa básica, por local de residência da vítima, dividido pela população residente (IBGE) e multiplicado por 100 mil. Sistema de Informações sobre Mortalidade (SIM), arquivos DO{UF}{ano}.dbc do FTP do DATASUS. Mesma definição de homicídio do Atlas da Violência (Ipea/FBSP).',
    },
    view: { type: 'timeseries', options: {} },
    caveats: [
      'Conta pelo lugar onde a vítima morava, não onde ela morreu.',
      'Mortes violentas sem causa definida (quando não se sabe se foi assassinato, acidente ou suicídio) não entram. Em alguns estados elas são muitas, e o número real de assassinatos pode ser maior.',
      PRELIMINAR,
      POPULACAO,
    ],
    summary: { template: 'Em {period}, foram cerca de {round} assassinatos para cada 100 mil pessoas.' },
    originDocs: SIM_DOCS,
  },
  {
    id: 'mortalidade-infantil',
    title: 'Bebês que morrem antes de 1 ano (mortalidade infantil)',
    theme: 'saude',
    layer: 'necessidades-basicas',
    unit: 'por mil nascidos',
    decimals: 1,
    frequency: 'anual',
    polarity: 'menor-melhor',
    featured: true,
    territories: { levels: ['regiao', 'uf'] },
    explanation: {
      simple:
        'De cada 1.000 bebês que nascem vivos, quantos morrem antes de fazer 1 ano. É um dos números mais usados no mundo para saber se a saúde chega às famílias: pré-natal, parto, vacina, água limpa.',
      technical:
        'Óbitos de menores de 1 ano (SIM, por residência da mãe) divididos pelos nascidos vivos do mesmo ano e local (SINASC), vezes mil. Cálculo direto, sem a correção de sub-registro que o Ministério da Saúde aplica em alguns estados do Norte e Nordeste.',
    },
    view: { type: 'timeseries', options: {} },
    caveats: [
      'É o cálculo direto com os registros. Onde parte das mortes de bebês não chega a ser registrada (mais comum em áreas do Norte e do Nordeste), o número real é maior. O Ministério da Saúde publica uma taxa corrigida para esses estados, que não está aqui.',
      'Conta pelo lugar onde a mãe morava.',
      PRELIMINAR,
    ],
    summary: {
      template: 'Em {period}, de cada 1.000 bebês nascidos, cerca de {round} morreram antes de completar 1 ano.',
    },
    originDocs: SIM_DOCS,
  },
  {
    id: 'dengue',
    title: 'Casos de dengue',
    theme: 'saude',
    unit: 'por 100 mil',
    decimals: 1,
    frequency: 'mensal',
    polarity: 'menor-melhor',
    territories: { levels: ['regiao', 'uf'] },
    explanation: {
      simple:
        'Quantos casos prováveis de dengue começaram no mês para cada 100 mil moradores. A dengue sobe muito no verão e no começo do ano, com a chuva e o calor, e cai no inverno.',
      technical:
        'Notificações de dengue no SINAN, exceto as descartadas (CLASSI_FIN = 5), pelo mês de início dos sintomas (DT_SIN_PRI) e município de residência, divididas pela população do ano (IBGE) e multiplicadas por 100 mil. "Caso provável" é o critério dos boletins do Ministério da Saúde. Arquivos DENGBR{aa}.dbc do FTP do DATASUS.',
    },
    view: { type: 'timeseries', options: {} },
    caveats: [
      'Os meses mais recentes ainda vão subir: os casos entram no sistema semanas depois dos primeiros sintomas.',
      'Depende de a pessoa procurar atendimento e de o caso ser notificado. Casos leves que não vão ao posto não entram.',
      'Nos arquivos do DATASUS os casos descartados já vêm retirados.',
      POPULACAO,
    ],
    summary: { template: 'Em {period}, foram cerca de {round} casos de dengue para cada 100 mil pessoas.', compareHistory: false },
  },
];

type Obs = Extract<RecordDraft, { kind: 'observation' }>;

class Datasus extends BaseProcessor {
  constructor() {
    super(
      {
        id: 'datasus',
        name: 'DATASUS: mortes, nascimentos e dengue',
        publisher: 'Ministério da Saúde (DATASUS)',
        homepage: 'https://datasus.saude.gov.br/transferencia-de-arquivos/',
        docsUrl: 'https://datasus.saude.gov.br/transferencia-de-arquivos/',
        license: 'Dados abertos do governo federal (Decreto 8.777/2016)',
        access: {
          method: 'download',
          auth: 'nenhuma',
          notes:
            'FTP público ftp.datasus.gov.br, arquivos .dbc (DBF comprimido). Guardamos só as contagens, sem dado pessoal.',
        },
        publishFrequency: 'mensal',
        coverage: { territorial: ['pais', 'regiao', 'uf', 'municipio'], temporal: '2015 em diante' },
        limitations: [
          'Mortes e nascimentos definitivos saem com cerca de um ano de atraso; os anos mais recentes são preliminares e mudam.',
          'Os arquivos originais são grandes (o país inteiro passa de 100 MB por ano). Guardamos as contagens por município, idade e sexo; os arquivos finais não ficam guardados, só o endereço e o sha256 para conferir.',
          'Indicadores calculados por este site com a metodologia descrita em cada um. Podem diferir um pouco dos painéis oficiais por causa de correções e de data de extração.',
        ],
      },
      '0.1.0',
    );
  }

  datasets(): DatasetDescriptor[] {
    return DATASETS.map((d) => this.describe({ ...d, kind: 'observation' }));
  }

  protected async *collect(ctx: RunContext): AsyncIterable<Emission> {
    const desde = Number(ctx.options.desde ?? 2015);
    const limiteMs = Number(ctx.options.minutos ?? 40) * 60_000;
    const sistemas = (ctx.options.sistemas?.split(',') ?? Object.keys(PASTAS)) as Sistema[];

    const ftp = new DatasusFtp();
    try {
      await ftp.conectar();
      await this.atualizarArquivos(ctx, ftp, sistemas, desde, limiteMs);
    } finally {
      ftp.fechar();
    }

    const anoAtual = new Date().getFullYear();
    const anos = Array.from({ length: anoAtual - desde + 1 }, (_, i) => desde + i);
    const pop = await carregarPopulacao(ctx, anos);
    yield* this.indicadores(ctx, pop, desde);
  }

  /** Baixa e lê os arquivos novos ou alterados. Para quando passa do tempo-limite; continua na próxima coleta. */
  private async atualizarArquivos(ctx: RunContext, ftp: DatasusFtp, sistemas: Sistema[], desde: number, limiteMs: number) {
    const repo = ctx.storage.datasus;
    const inicio = Date.now();
    const candidatos: Candidato[] = [];
    for (const sistema of sistemas) {
      const achados: Candidato[] = [];
      for (const pasta of PASTAS[sistema] ?? []) {
        for (const a of await ftp.listar(pasta.caminho)) {
          const id = pasta.ler(a.caminho.split('/').pop()!);
          if (id && id.ano >= desde) achados.push({ ...a, ...id, sistema, final: pasta.final });
        }
      }
      // Quando sai o arquivo final de um ano, o preliminar do mesmo ano sai de cena.
      const finais = new Set(achados.filter((c) => c.final).map((c) => `${c.uf}:${c.ano}`));
      for (const c of achados) if (!c.final && finais.has(`${c.uf}:${c.ano}`)) this.removerPreliminar(ctx, c.caminho);
      candidatos.push(...achados.filter((c) => c.final || !finais.has(`${c.uf}:${c.ano}`)));
    }

    // Anos mais recentes primeiro: o site ganha o número que mais interessa logo na primeira coleta.
    const pendentes = candidatos
      .filter((c) => repo.arquivo(c.caminho)?.versao !== c.versao)
      .sort((a, b) => b.ano - a.ano || a.caminho.localeCompare(b.caminho));
    ctx.log(`${candidatos.length} arquivos na origem, ${pendentes.length} novos ou alterados`);

    let feitos = 0;
    for (const c of pendentes) {
      if (Date.now() - inicio > limiteMs) {
        ctx.log(`tempo-limite: ${pendentes.length - feitos} arquivos ficam para a próxima coleta`);
        break;
      }
      try {
        const t0 = Date.now();
        const corpo = await ftp.baixar(c.caminho);
        const modificado = await ftp.modificado(c.caminho).catch(() => new Date().toISOString());
        const r = agregar(lerDbc(corpo), c.sistema, c.ano);
        const url = ftp.url(c.caminho);
        const anterior = repo.arquivo(c.caminho);
        const raw = ctx.storage.raw.save(corpo, url, 'application/x-dbc', { keep: !c.final });
        if (anterior && anterior.rawHash !== raw.hash) ctx.storage.raw.discard(anterior.rawHash);
        repo.substituir(
          {
            caminho: c.caminho,
            sistema: c.sistema,
            uf: c.uf,
            ano: c.ano,
            final: c.final,
            url,
            modificado,
            versao: c.versao,
            bytes: corpo.length,
            rawHash: raw.hash,
            registros: r.lidos,
            processadoEm: new Date().toISOString(),
          },
          r.contagens,
        );
        feitos++;
        ctx.log(
          `${c.caminho}: ${r.lidos} registros, ${r.contagens.length} contagens, ${(corpo.length / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
        );
      } catch (err) {
        ctx.issue(`${c.caminho}: ${(err as Error).message}`);
      }
    }
  }

  private removerPreliminar(ctx: RunContext, caminho: string) {
    const a = ctx.storage.datasus.arquivo(caminho);
    if (!a) return;
    ctx.storage.datasus.remover(caminho);
    ctx.storage.raw.discard(a.rawHash);
    ctx.log(`${caminho}: saiu o dado final do mesmo ano, o preliminar foi retirado`);
  }

  private *indicadores(ctx: RunContext, pop: Populacao, desde: number): Iterable<Emission> {
    const repo = ctx.storage.datasus;
    const arquivos = repo.arquivos();
    const agora = new Date();
    const anoAtual = agora.getFullYear();

    // Ano completo = os 27 estados carregados e o ano já terminou.
    const completos = (sistema: Sistema) => {
      const porAno = new Map<number, number>();
      for (const a of arquivos) if (a.sistema === sistema) porAno.set(a.ano, (porAno.get(a.ano) ?? 0) + 1);
      return new Set([...porAno].filter(([ano, n]) => n >= N_UFS && ano < anoAtual && ano >= desde).map(([ano]) => ano));
    };
    const origemUf = (sistema: Sistema, uf: string, ano: number): Origin => {
      const sigla = Object.keys(UFS).find((s) => UFS[s] === uf);
      const a = arquivos.find((x) => x.sistema === sistema && x.ano === ano && x.uf === sigla);
      return origemDe(a, sistema);
    };
    const origemDe = (a: DatasusArquivo | undefined, sistema: Sistema): Origin =>
      a
        ? { url: a.url, rawHash: a.rawHash, fetchedAt: a.processadoEm }
        : { url: `ftp://ftp.datasus.gov.br/dissemin/publicos/${PASTAS[sistema][0]!.caminho}/`, rawHash: '', fetchedAt: agora.toISOString() };

    // ── Homicídios por 100 mil ─────────────────────────────────────────────
    const anosSim = completos('sim');
    const homic = repo.somaPorUf('sim', { grupos: ['homicidio'] }).filter((r) => anosSim.has(r.ano));
    let n = 0;
    for (const p of territorios(homic)) {
      const habitantes = pop.de(p.level, p.code, p.ano);
      if (!habitantes) continue;
      const origem = p.level === 'uf' ? origemUf('sim', p.code, p.ano) : origemDe(undefined, 'sim');
      yield this.emit('homicidios', limpa(origem), obs('homicidios', p, (p.n / habitantes) * 1e5, pop, { casos: String(p.n) }));
      n++;
    }
    ctx.log(`homicidios: ${n} observações (${[...anosSim].sort().join(', ') || 'nenhum ano completo ainda'})`);

    // ── Mortalidade infantil por mil nascidos ──────────────────────────────
    const anosNasc = completos('sinasc');
    const anosInf = new Set([...anosSim].filter((a) => anosNasc.has(a)));
    const obitos = territorios(repo.somaPorUf('sim', { faixas: ['menos-1'] }).filter((r) => anosInf.has(r.ano)));
    const nascidos = new Map(
      territorios(repo.somaPorUf('sinasc').filter((r) => anosInf.has(r.ano))).map((p) => [`${p.level}:${p.code}:${p.ano}`, p]),
    );
    n = 0;
    for (const p of obitos) {
      const nv = nascidos.get(`${p.level}:${p.code}:${p.ano}`);
      if (!nv?.n) continue;
      const origem = p.level === 'uf' ? origemUf('sim', p.code, p.ano) : origemDe(undefined, 'sim');
      const ponto = { ...p, preliminar: p.preliminar || nv.preliminar };
      yield this.emit(
        'mortalidade-infantil',
        limpa(origem),
        obs('mortalidade-infantil', ponto, (p.n / nv.n) * 1000, pop, { obitos: String(p.n), nascidos: String(nv.n) }),
      );
      n++;
    }
    ctx.log(`mortalidade-infantil: ${n} observações`);

    // ── Dengue por 100 mil, por mês ────────────────────────────────────────
    const anosDengue = new Set(arquivos.filter((a) => a.sistema === 'sinan-dengue').map((a) => a.ano));
    const mesAtual = anoAtual * 100 + agora.getMonth() + 1;
    const casos = repo
      .somaPorUf('sinan-dengue', { porMes: true })
      .filter((r) => r.mes > 0 && r.ano >= desde && anosDengue.has(r.ano) && r.ano * 100 + r.mes < mesAtual);
    const origemDengue = (ano: number) => origemDe(arquivos.find((a) => a.sistema === 'sinan-dengue' && a.ano === ano), 'sinan-dengue');
    n = 0;
    for (const p of territorios(casos)) {
      const habitantes = pop.de(p.level, p.code, p.ano);
      if (!habitantes) continue;
      yield this.emit('dengue', limpa(origemDengue(p.ano)), obs('dengue', p, (p.n / habitantes) * 1e5, pop, { casos: String(p.n) }));
      n++;
    }
    ctx.log(`dengue: ${n} observações`);
  }
}

interface Ponto {
  level: TerritoryLevel;
  code: string;
  ano: number;
  mes: number;
  n: number;
  preliminar: boolean;
}

/** Soma as contagens por UF em Brasil, regiões e estados. Casos sem estado de residência só entram no Brasil. */
function territorios(rows: { ano: number; mes: number; uf: string; n: number; preliminar: boolean }[]): Ponto[] {
  const mapa = new Map<string, Ponto>();
  const soma = (level: TerritoryLevel, code: string, r: (typeof rows)[number]) => {
    const k = `${level}:${code}:${r.ano}:${r.mes}`;
    const p = mapa.get(k) ?? { level, code, ano: r.ano, mes: r.mes, n: 0, preliminar: false };
    p.n += r.n;
    p.preliminar ||= r.preliminar;
    mapa.set(k, p);
  };
  for (const r of rows) {
    soma('pais', '1', r);
    if (Object.values(UFS).includes(r.uf)) {
      soma('regiao', r.uf[0]!, r);
      soma('uf', r.uf, r);
    }
  }
  return [...mapa.values()];
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function obs(datasetId: string, p: Ponto, valor: number, pop: Populacao, extra: Record<string, string>): Obs {
  const periodo =
    p.mes > 0
      ? {
          start: iso(p.ano, p.mes, 1),
          end: iso(p.ano, p.mes, new Date(Date.UTC(p.ano, p.mes, 0)).getUTCDate()),
          label: `${MESES[p.mes - 1]}/${p.ano}`,
        }
      : { start: iso(p.ano, 1, 1), end: iso(p.ano, 12, 31), label: String(p.ano) };
  const chavePeriodo = p.mes > 0 ? `${p.ano}${String(p.mes).padStart(2, '0')}` : String(p.ano);
  return {
    kind: 'observation',
    id: `${datasetId}:${p.level}:${p.code}:${chavePeriodo}`,
    period: periodo,
    territory: { level: p.level, code: p.code, name: pop.nome(p.level, p.code) },
    value: Math.round(valor * 100) / 100,
    dimensions: { ...extra, dado: p.preliminar ? 'preliminar' : 'final' },
  };
}

/** rawHash vazio (soma de vários arquivos) não vai para a proveniência. */
function limpa(o: Origin): Origin {
  return o.rawHash ? o : ({ url: o.url, fetchedAt: o.fetchedAt } as Origin);
}

export default new Datasus();
