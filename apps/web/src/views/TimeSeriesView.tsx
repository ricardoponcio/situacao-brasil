import { useRef, useState } from 'react';
import type { DatasetDescriptor, Observation, SbRecord } from '@sb/core';
import { LineChart, type ChartPoint, type ChartSeries, type ReferenceBand, type ReferenceLine } from '../components/charts/LineChart.tsx';
import { NextRelease } from '../components/NextRelease.tsx';
import { api } from '../lib/api.ts';
import { formatNumber, formatValue } from '../lib/format.ts';
import { ESTADOS, REGIOES, territoryKey, type TerritoryOption } from '../lib/territories.ts';
import { useAsync } from '../lib/useAsync.ts';
import type { Tone } from '../components/ui.tsx';
import type { ViewDefinition, ViewProps } from './types.ts';

interface Options {
  referenceLines?: ReferenceLine[];
  referenceBand?: ReferenceBand;
}

/** Variação entre os dois últimos valores, em linguagem simples. */
function describeChange(last: Observation, prev: Observation | undefined, unit: string | undefined, decimals: number) {
  if (!prev || last.value === null || prev.value === null) return null;
  const diff = last.value - prev.value;
  const abs = formatNumber(Math.abs(diff), decimals);
  const what = unit === '%' ? `${abs} ponto${Math.abs(diff) >= 2 ? 's' : ''}` : formatValue(Math.abs(diff), unit, decimals);
  if (Math.abs(diff) < 10 ** -decimals / 2) return { text: `Igual a ${prev.period.label}`, dir: 0 };
  return { text: `${diff > 0 ? 'Subiu' : 'Caiu'} ${what} em relação a ${prev.period.label}`, dir: Math.sign(diff) };
}

const observations = (records: SbRecord[]) =>
  records
    .filter((r): r is Observation => r.kind === 'observation')
    .sort((a, b) => a.period.start.localeCompare(b.period.start));

/** O ponto fica no início do período: assim o ano 2024 cai na marca "2024" do eixo, e o mês, na do mês. */
const toPoints = (rows: Observation[]): ChartPoint[] =>
  rows.map((r) => ({ x: new Date(`${r.period.start}T12:00:00`).getTime(), y: r.value, label: r.period.label }));

const BRASIL_COLOR = 'var(--series-1)';
/** Cores das linhas comparadas, na ordem em que entram. Validadas (daltonismo) contra o fundo do cartão. */
const SLOT_COLORS = ['var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

const RANGES = [
  { id: '6m', months: 6, label: '6 meses' },
  { id: '1a', months: 12, label: '1 ano' },
  { id: '5a', months: 60, label: '5 anos' },
  { id: '10a', months: 120, label: '10 anos' },
];

const monthIndex = (x: number) => {
  const d = new Date(x);
  return d.getFullYear() * 12 + d.getMonth();
};

/** Só os pontos dos últimos `months` meses, contando o mês do dado mais recente. */
function cut(points: ChartPoint[], months: number, lastX: number): ChartPoint[] {
  const from = monthIndex(lastX) - months;
  return points.filter((p) => monthIndex(p.x) > from);
}

/** Períodos que fazem sentido para a série: com 2 pontos ou mais, e que mostram mais que o período menor. */
function availableRanges(points: ChartPoint[], lastX: number) {
  let prev = 0;
  return RANGES.filter((r) => {
    const n = cut(points, r.months, lastX).filter((p) => p.y !== null).length;
    if (n < 2 || n <= prev) return false;
    prev = n;
    return true;
  });
}

interface Picked {
  t: TerritoryOption;
  /** Índice em SLOT_COLORS: a cor fica com o território enquanto ele estiver na comparação. */
  slot: number;
}

async function loadSeries(datasetId: string, level: string, territory: string): Promise<ChartPoint[]> {
  const { records } = await api.records(datasetId, { level, territory, order: 'desc', limit: 500 });
  return toPoints(observations(records));
}

/** Gráfico da página do dado: escolha do período e comparação com regiões e estados. */
function ChartExplorer({ descriptor, national }: { descriptor: DatasetDescriptor; national: ChartPoint[] }) {
  const opts = descriptor.view.options as Options;
  const terr = descriptor.territories;
  const [rangeId, setRangeId] = useState('10a');
  const [picked, setPicked] = useState<Picked[]>([]);

  // Comparando, o Brasil vem do mesmo dataset dos estados (ex.: a série trimestral), para a conta ser a mesma.
  const compareId = terr?.datasetId ?? descriptor.id;
  const key = picked.map((p) => territoryKey(p.t)).join(',');
  const state = useAsync(async (): Promise<ChartSeries[]> => {
    const brasil = picked.length && terr?.datasetId ? await loadSeries(compareId, 'pais', '1') : national;
    const others = await Promise.all(picked.map((p) => loadSeries(compareId, p.t.level, p.t.code)));
    return [
      { id: 'brasil', label: 'Brasil', color: BRASIL_COLOR, points: brasil },
      ...picked.map((p, i) => ({ id: territoryKey(p.t), label: p.t.short, color: SLOT_COLORS[p.slot]!, points: others[i]! })),
    ];
  }, [descriptor.id, key]);

  // Enquanto carrega, o gráfico anterior fica na tela (mais apagado), sem pular.
  const lastOk = useRef<ChartSeries[] | null>(null);
  if (state.status === 'ok') lastOk.current = state.data;
  const series = lastOk.current ?? [{ id: 'brasil', label: 'Brasil', color: BRASIL_COLOR, points: national }];

  const base = series[0]!.points;
  const lastX = Math.max(...series.flatMap((s) => s.points.filter((p) => p.y !== null).map((p) => p.x)));
  const ranges = availableRanges(base, lastX);
  const range = ranges.find((r) => r.id === rangeId) ?? ranges[ranges.length - 1];
  const shown = range ? series.map((s) => ({ ...s, points: cut(s.points, range.months, lastX) })) : series;

  const options = [
    ...(terr?.levels.includes('regiao') ? [{ label: 'Regiões', items: REGIOES }] : []),
    ...(terr?.levels.includes('uf') ? [{ label: 'Estados', items: ESTADOS }] : []),
  ];
  const pickedKeys = new Set(picked.map((p) => territoryKey(p.t)));
  const full = picked.length >= SLOT_COLORS.length;
  const add = (k: string) => {
    const t = options.flatMap((g) => g.items).find((o) => territoryKey(o) === k);
    if (!t || full) return;
    const used = new Set(picked.map((p) => p.slot));
    setPicked([...picked, { t, slot: SLOT_COLORS.findIndex((_, i) => !used.has(i)) }]);
  };
  const first = shown[0]!.points.find((p) => p.y !== null);
  const last = [...shown[0]!.points].reverse().find((p) => p.y !== null);

  return (
    <>
      {(ranges.length > 1 || options.length > 0) && (
        <div className="chart-controls">
          {ranges.length > 1 && (
            <div className="segmented" role="group" aria-label="Período do gráfico">
              {ranges.map((r) => (
                <button key={r.id} type="button" aria-pressed={r.id === range?.id} onClick={() => setRangeId(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
          )}
          {options.length > 0 && (
            <label className="compare">
              <span className="visually-hidden">Comparar com uma região ou um estado</span>
              <select value="" disabled={full} onChange={(e) => add(e.currentTarget.value)}>
                <option value="">{full ? `Até ${SLOT_COLORS.length} ao mesmo tempo` : 'Comparar com um estado ou região…'}</option>
                {options.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items
                      .filter((o) => !pickedKeys.has(territoryKey(o)))
                      .map((o) => (
                        <option key={territoryKey(o)} value={territoryKey(o)}>
                          {o.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {picked.length > 0 && (
        <div className="chips" aria-label="Linhas no gráfico">
          <span className="chip static">
            <span className="line-key" style={{ background: BRASIL_COLOR }} aria-hidden />
            Brasil
          </span>
          {picked.map((p) => (
            <button
              key={territoryKey(p.t)}
              type="button"
              className="chip"
              onClick={() => setPicked(picked.filter((x) => x !== p))}
              aria-label={`Tirar ${p.t.name} da comparação`}
            >
              <span className="line-key" style={{ background: SLOT_COLORS[p.slot] }} aria-hidden />
              {p.t.name}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
      {picked.length > 0 && terr?.note && <p className="stat-sub chart-note">{terr.note}</p>}
      {state.status === 'error' && <p className="muted">Não foi possível carregar a comparação: {state.error.message}</p>}
      <div className={state.status === 'loading' ? 'chart-loading' : undefined}>
        <LineChart
          series={shown}
          unit={descriptor.unit}
          decimals={descriptor.decimals}
          height={280}
          referenceLines={opts.referenceLines}
          referenceBand={opts.referenceBand}
          ariaLabel={`${descriptor.title}: ${shown.map((s) => s.label).join(', ')}, de ${first?.label} a ${last?.label}`}
        />
      </div>
    </>
  );
}

function TimeSeries({ descriptor, records, mode }: ViewProps) {
  const opts = descriptor.view.options as Options;
  const rows = observations(records);
  const points = toPoints(rows);
  const withValue = rows.filter((r) => r.value !== null);
  const last = withValue[withValue.length - 1];
  const prev = withValue[withValue.length - 2];

  if (!last) return <p className="muted">Ainda não há dados coletados.</p>;

  const change = describeChange(last, prev, descriptor.unit, descriptor.decimals);
  let tone: Tone = 'neutral';
  if (change && change.dir !== 0 && descriptor.polarity !== 'neutro') {
    const upIsGood = descriptor.polarity === 'maior-melhor';
    tone = (change.dir > 0) === upIsGood ? 'good' : 'bad';
  }

  return (
    <>
      <div>
        <div className="stat-value">{formatValue(last.value, descriptor.unit, descriptor.decimals)}</div>
        <div className="stat-sub">
          {last.territory.name ?? 'Brasil'} · {last.period.label}
        </div>
        <NextRelease descriptor={descriptor} />
      </div>
      {change && (
        <div>
          <span className={`delta ${tone === 'neutral' ? '' : tone}`}>
            <span className="delta-icon" aria-hidden>
              {change.dir > 0 ? '▲' : change.dir < 0 ? '▼' : '='}
            </span>
            {change.text}
            {tone === 'good' && ' (melhorou)'}
            {tone === 'bad' && ' (piorou)'}
          </span>
        </div>
      )}
      {mode === 'full' ? (
        <ChartExplorer descriptor={descriptor} national={points} />
      ) : (
        <LineChart
          series={[{ id: 'brasil', label: 'Brasil', color: BRASIL_COLOR, points }]}
          unit={descriptor.unit}
          decimals={descriptor.decimals}
          height={150}
          referenceLines={opts.referenceLines}
          referenceBand={opts.referenceBand}
          ariaLabel={`${descriptor.title}: série de ${points[0]?.label} a ${last.period.label}`}
        />
      )}
      {opts.referenceBand && (
        <div className="stat-sub" style={{ fontSize: 13 }}>
          <span aria-hidden style={{ display: 'inline-block', width: 12, height: 10, background: 'var(--band)', marginRight: 6, verticalAlign: 'middle' }} />
          {opts.referenceBand.label}
        </div>
      )}
    </>
  );
}

export const timeSeriesView: ViewDefinition = {
  // Padrão: Brasil inteiro, os 120 períodos mais recentes (a view reordena cronologicamente).
  query: () => ({ level: 'pais', territory: '1', order: 'desc', limit: 120 }),
  component: TimeSeries,
};
