import type { ViewProps } from '../../views/types.ts';
import { LineChart } from '../charts/LineChart.tsx';
import { seriesHeadline } from '../../controllers/series.ts';
import { BandLegend, ChangeBadge, StatValue } from './Destaque.tsx';
import { ChartExplorer, type ChartOptions } from './ChartExplorer.tsx';
import { BRASIL_COLOR } from './Comparacao.tsx';

/** Número em destaque, variação e gráfico. Na página do dado (`full`), o gráfico ganha período e comparação. */
export function TimeSeries({ descriptor, records, mode }: ViewProps) {
  const opts = descriptor.view.options as ChartOptions;
  const { points, last, change, tone } = seriesHeadline(descriptor, records);
  if (!last) return <p className="muted">Ainda não há dados coletados.</p>;

  return (
    <>
      <StatValue descriptor={descriptor} last={last} />
      {change && <ChangeBadge change={change} tone={tone} />}
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
      {opts.referenceBand && <BandLegend band={opts.referenceBand} />}
    </>
  );
}
