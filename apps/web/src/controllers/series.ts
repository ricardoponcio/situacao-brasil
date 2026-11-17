/**
 * Regras das séries de números ao longo do tempo: último valor, variação em linguagem simples, se melhorou ou
 * piorou, períodos do gráfico e escolha das linhas comparadas. Sem React: só dados.
 */
import type { DatasetDescriptor, Observation, SbRecord } from '@sb/core';
import type { ChartPoint } from '../components/charts/LineChart.tsx';
import { formatNumber, formatValue } from '../lib/format.ts';
import type { TerritoryOption } from '../lib/territories.ts';
import type { Tone } from '../components/ui.tsx';

/** Observações em ordem cronológica. */
export const observations = (records: SbRecord[]) =>
  records
    .filter((r): r is Observation => r.kind === 'observation')
    .sort((a, b) => a.period.start.localeCompare(b.period.start));

/** O ponto fica no início do período: assim o ano 2024 cai na marca "2024" do eixo, e o mês, na do mês. */
export const toPoints = (rows: Observation[]): ChartPoint[] =>
  rows.map((r) => ({ x: new Date(`${r.period.start}T12:00:00`).getTime(), y: r.value, label: r.period.label }));

export interface Change {
  text: string;
  /** 1 subiu, -1 caiu, 0 igual. */
  dir: number;
}

/** Variação entre os dois últimos valores, em linguagem simples. */
export function describeChange(last: Observation, prev: Observation | undefined, unit: string | undefined, decimals: number): Change | null {
  if (!prev || last.value === null || prev.value === null) return null;
  const diff = last.value - prev.value;
  const abs = formatNumber(Math.abs(diff), decimals);
  const what = unit === '%' ? `${abs} ponto${Math.abs(diff) >= 2 ? 's' : ''}` : formatValue(Math.abs(diff), unit, decimals);
  if (Math.abs(diff) < 10 ** -decimals / 2) return { text: `Igual a ${prev.period.label}`, dir: 0 };
  return { text: `${diff > 0 ? 'Subiu' : 'Caiu'} ${what} em relação a ${prev.period.label}`, dir: Math.sign(diff) };
}

/** Subir é bom ou ruim? Depende da polaridade do indicador (desemprego subir é ruim; renda subir é bom). */
export function changeTone(change: Change | null, polarity: DatasetDescriptor['polarity']): Tone {
  if (!change || change.dir === 0 || polarity === 'neutro') return 'neutral';
  const upIsGood = polarity === 'maior-melhor';
  return (change.dir > 0) === upIsGood ? 'good' : 'bad';
}

/** O que o topo da série mostra: o último valor, os pontos do gráfico e a variação. */
export function seriesHeadline(d: DatasetDescriptor, records: SbRecord[]) {
  const rows = observations(records);
  const withValue = rows.filter((r) => r.value !== null);
  const last = withValue[withValue.length - 1];
  const prev = withValue[withValue.length - 2];
  const change = last ? describeChange(last, prev, d.unit, d.decimals) : null;
  return { points: toPoints(rows), last, change, tone: changeTone(change, d.polarity) };
}

// ---------- Períodos do gráfico ----------

export interface Range {
  id: string;
  months: number;
  label: string;
}

export const RANGES: Range[] = [
  { id: '6m', months: 6, label: '6 meses' },
  { id: '1a', months: 12, label: '1 ano' },
  { id: '5a', months: 60, label: '5 anos' },
  { id: '10a', months: 120, label: '10 anos' },
];

export const DEFAULT_RANGE = '10a';

const monthIndex = (x: number) => {
  const d = new Date(x);
  return d.getFullYear() * 12 + d.getMonth();
};

/** Só os pontos dos últimos `months` meses, contando o mês do dado mais recente. */
export function cut(points: ChartPoint[], months: number, lastX: number): ChartPoint[] {
  const from = monthIndex(lastX) - months;
  return points.filter((p) => monthIndex(p.x) > from);
}

/** Períodos que fazem sentido para a série: com 2 pontos ou mais, e que mostram mais que o período menor. */
export function availableRanges(points: ChartPoint[], lastX: number): Range[] {
  let prev = 0;
  return RANGES.filter((r) => {
    const n = cut(points, r.months, lastX).filter((p) => p.y !== null).length;
    if (n < 2 || n <= prev) return false;
    prev = n;
    return true;
  });
}

/** Recorta todas as linhas no período escolhido (ou no maior disponível). */
export function applyRange<S extends { points: ChartPoint[] }>(series: S[], rangeId: string) {
  const lastX = Math.max(...series.flatMap((s) => s.points.filter((p) => p.y !== null).map((p) => p.x)));
  const ranges = availableRanges(series[0]!.points, lastX);
  const range = ranges.find((r) => r.id === rangeId) ?? ranges[ranges.length - 1];
  const shown = range ? series.map((s) => ({ ...s, points: cut(s.points, range.months, lastX) })) : series;
  const base = shown[0]!.points;
  return {
    ranges,
    range,
    shown,
    first: base.find((p) => p.y !== null),
    last: [...base].reverse().find((p) => p.y !== null),
  };
}

// ---------- Comparação com regiões e estados ----------

/** Quantas linhas além do Brasil cabem no gráfico (uma cor validada para cada). */
export const MAX_COMPARE = 3;

export interface Picked {
  t: TerritoryOption;
  /** Posição da cor: fica com o território enquanto ele estiver na comparação. */
  slot: number;
}

/** Acrescenta um território na primeira cor livre. Sem efeito se já estiver cheio. */
export function addPicked(picked: Picked[], t: TerritoryOption): Picked[] {
  if (picked.length >= MAX_COMPARE) return picked;
  const used = new Set(picked.map((p) => p.slot));
  const slot = Array.from({ length: MAX_COMPARE }, (_, i) => i).find((i) => !used.has(i))!;
  return [...picked, { t, slot }];
}
