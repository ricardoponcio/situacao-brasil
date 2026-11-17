/** O topo de um indicador: o número, de onde e quando, a próxima divulgação, a variação e a legenda da faixa. */
import type { DatasetDescriptor, Observation } from '@sb/core';
import type { ReferenceBand } from '../charts/LineChart.tsx';
import { formatValue } from '../../lib/format.ts';
import type { Change } from '../../controllers/series.ts';
import type { Tone } from '../ui.tsx';
import { NextRelease } from '../NextRelease.tsx';

export function StatValue({ descriptor, last }: { descriptor: DatasetDescriptor; last: Observation }) {
  return (
    <div>
      <div className="stat-value">{formatValue(last.value, descriptor.unit, descriptor.decimals)}</div>
      <div className="stat-sub">
        {last.territory.name ?? 'Brasil'} · {last.period.label}
      </div>
      <NextRelease descriptor={descriptor} />
    </div>
  );
}

/** "▲ Subiu 0,3 ponto em relação a jul/2026 (piorou)". */
export function ChangeBadge({ change, tone }: { change: Change; tone: Tone }) {
  return (
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
  );
}

/** Legenda da faixa de referência (ex.: o intervalo da meta de inflação). */
export function BandLegend({ band }: { band: ReferenceBand }) {
  return (
    <div className="stat-sub" style={{ fontSize: 13 }}>
      <span aria-hidden style={{ display: 'inline-block', width: 12, height: 10, background: 'var(--band)', marginRight: 6, verticalAlign: 'middle' }} />
      {band.label}
    </div>
  );
}
