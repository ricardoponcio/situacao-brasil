import type { DatasetDescriptor, DatasetDescriptorInput, TerritoryLevel } from '@sb/core';
import { BaseProcessor, type Emission } from '../../framework/BaseProcessor.ts';
import type { RunContext } from '../../framework/Processor.ts';

/** Níveis territoriais do SIDRA → nossos níveis. */
const NIVEIS: Record<string, TerritoryLevel> = { N1: 'pais', N2: 'regiao', N3: 'uf', N6: 'municipio' };

export type SidraPeriodType = 'mes' | 'trimestre-movel' | 'trimestre' | 'ano';

/** Uma série do SIDRA = um dataset nosso. Adicionar indicador = adicionar uma destas. */
export interface SidraSeries {
  descriptor: Omit<DatasetDescriptorInput, 'sourceId' | 'kind'>;
  agregado: number;
  variavel: number;
  /** Ex.: "-120" = últimos 120 períodos */
  periodos: string;
  niveis: (keyof typeof NIVEIS)[];
  periodType: SidraPeriodType;
  /** Ex.: "315[7169]" (classificação[categoria]) */
  classificacao?: string;
}

interface SidraVariable {
  id: string;
  variavel: string;
  unidade: string;
  resultados: {
    classificacoes: unknown[];
    series: { localidade: { id: string; nome: string; nivel: { id: string } }; serie: Record<string, string> }[];
  }[];
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Converte o código de período do SIDRA em intervalo de datas + rótulo humano. */
export function parsePeriod(code: string, type: SidraPeriodType) {
  const year = Number(code.slice(0, 4));
  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

  switch (type) {
    case 'ano':
      return { start: iso(year, 1, 1), end: iso(year, 12, 31), label: String(year) };
    case 'mes': {
      const m = Number(code.slice(4, 6));
      return { start: iso(year, m, 1), end: iso(year, m, lastDay(year, m)), label: `${MESES[m - 1]}/${year}` };
    }
    case 'trimestre': {
      const q = Number(code.slice(4, 6));
      const m0 = (q - 1) * 3 + 1;
      return { start: iso(year, m0, 1), end: iso(year, m0 + 2, lastDay(year, m0 + 2)), label: `${q}º tri/${year}` };
    }
    case 'trimestre-movel': {
      // Código = mês final do trimestre móvel (202608 = jun-jul-ago/2026)
      const mEnd = Number(code.slice(4, 6));
      const startDate = new Date(Date.UTC(year, mEnd - 3, 1));
      const sy = startDate.getUTCFullYear();
      const sm = startDate.getUTCMonth() + 1;
      return {
        start: iso(sy, sm, 1),
        end: iso(year, mEnd, lastDay(year, mEnd)),
        label: `${MESES[sm - 1]}–${MESES[mEnd - 1]}/${year}`,
      };
    }
  }
}

/** "..." (não disponível), "-" (zero absoluto/não se aplica), "X" (sigilo) → null */
function parseValue(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isFinite(n) ? n : null;
}

/** Processador genérico para a API de agregados do IBGE (SIDRA), configurado por séries. */
export class SidraProcessor extends BaseProcessor {
  private readonly descriptors: DatasetDescriptor[];

  constructor(private readonly series: SidraSeries[]) {
    super(
      {
        id: 'ibge-sidra',
        name: 'IBGE – SIDRA (API de agregados)',
        publisher: 'Instituto Brasileiro de Geografia e Estatística (IBGE)',
        homepage: 'https://sidra.ibge.gov.br/',
        docsUrl: 'https://servicodados.ibge.gov.br/api/docs/agregados?versao=3',
        license: 'Dados públicos; uso livre com citação da fonte (IBGE).',
        access: {
          method: 'api-rest',
          auth: 'nenhuma',
          notes: 'Cada tabela (agregado) tem variáveis e classificações próprias; os códigos estão no próprio SIDRA.',
        },
        publishFrequency: 'mensal',
        coverage: { territorial: ['pais', 'regiao', 'uf', 'municipio'], temporal: 'Varia por tabela.' },
        limitations: [
          'Pesquisas por amostra (PNAD, por exemplo) têm margem de erro, que esta coleta ainda não traz.',
          'O IBGE pode revisar números já publicados; o valor guardado é sempre o da última coleta.',
        ],
      },
      '0.1.0',
    );
    this.descriptors = series.map((s) => this.describe({ ...s.descriptor, kind: 'observation' }));
  }

  datasets(): DatasetDescriptor[] {
    return this.descriptors;
  }

  protected async *collect(ctx: RunContext): AsyncIterable<Emission> {
    for (const s of this.series) {
      const datasetId = s.descriptor.id;
      const localidades = s.niveis.map((n) => `${n}[all]`).join('|');
      const params = new URLSearchParams({ localidades });
      if (s.classificacao) params.set('classificacao', s.classificacao);
      const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${s.agregado}/periodos/${s.periodos}/variaveis/${s.variavel}?${params}`;

      let res;
      try {
        res = await ctx.http.getJson<SidraVariable[]>(url);
      } catch (err) {
        ctx.issue(`${datasetId}: ${(err as Error).message}`);
        continue;
      }

      let n = 0;
      for (const variable of res.data) {
        for (const result of variable.resultados) {
          for (const serie of result.series) {
            const level = NIVEIS[serie.localidade.nivel.id];
            if (!level) continue;
            for (const [code, raw] of Object.entries(serie.serie)) {
              n++;
              yield this.emit(datasetId, res.origin, {
                kind: 'observation',
                id: `${datasetId}:${level}:${serie.localidade.id}:${code}`,
                period: parsePeriod(code, s.periodType),
                territory: { level, code: serie.localidade.id, name: serie.localidade.nome },
                value: parseValue(raw),
                dimensions: { sidraPeriodo: code, unidadeOrigem: variable.unidade },
              });
            }
          }
        }
      }
      ctx.log(`${datasetId}: ${n} observações`);
    }
  }
}
