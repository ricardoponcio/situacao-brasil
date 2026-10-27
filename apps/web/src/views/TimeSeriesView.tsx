import type { Observation } from '@sb/core';
import { LineChart, type ReferenceBand, type ReferenceLine } from '../components/charts/LineChart.tsx';
import { formatNumber, formatValue } from '../lib/format.ts';
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

function TimeSeries({ descriptor, records, mode }: ViewProps) {
  const opts = descriptor.view.options as Options;
  const rows = records
    .filter((r): r is Observation => r.kind === 'observation')
    .sort((a, b) => a.period.start.localeCompare(b.period.start));
  const points = rows.map((r) => ({ x: new Date(`${r.period.end}T12:00:00`).getTime(), y: r.value, label: r.period.label }));
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
      <LineChart
        points={points}
        unit={descriptor.unit}
        decimals={descriptor.decimals}
        height={mode === 'card' ? 150 : 280}
        referenceLines={opts.referenceLines}
        referenceBand={opts.referenceBand}
        ariaLabel={`${descriptor.title}: série de ${points[0]?.label} a ${last.period.label}`}
      />
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
