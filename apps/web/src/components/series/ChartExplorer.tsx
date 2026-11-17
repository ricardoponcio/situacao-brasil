import { useState } from 'react';
import type { DatasetDescriptor } from '@sb/core';
import { LineChart, type ChartPoint, type ReferenceBand, type ReferenceLine } from '../charts/LineChart.tsx';
import { Segmented } from '../ui.tsx';
import { ESTADOS, REGIOES } from '../../lib/territories.ts';
import { DEFAULT_RANGE, addPicked, applyRange, type Picked } from '../../controllers/series.ts';
import { useComparedSeries } from '../../hooks/useSeries.ts';
import { BRASIL_COLOR, CompareChips, ComparePicker, SLOT_COLORS, type TerritoryGroup } from './Comparacao.tsx';

/** Opções do gráfico que o descriptor pode trazer (`view.options`). */
export interface ChartOptions {
  referenceLines?: ReferenceLine[];
  referenceBand?: ReferenceBand;
}

/** Gráfico da página do dado: escolha do período e comparação com regiões e estados. */
export function ChartExplorer({ descriptor, national }: { descriptor: DatasetDescriptor; national: ChartPoint[] }) {
  const opts = descriptor.view.options as ChartOptions;
  const terr = descriptor.territories;
  const [rangeId, setRangeId] = useState(DEFAULT_RANGE);
  const [picked, setPicked] = useState<Picked[]>([]);
  const { series, state } = useComparedSeries(descriptor, national, picked, { brasil: BRASIL_COLOR, slots: SLOT_COLORS });
  const { ranges, range, shown, first, last } = applyRange(series, rangeId);

  const groups: TerritoryGroup[] = [
    ...(terr?.levels.includes('regiao') ? [{ label: 'Regiões', items: REGIOES }] : []),
    ...(terr?.levels.includes('uf') ? [{ label: 'Estados', items: ESTADOS }] : []),
  ];

  return (
    <>
      {(ranges.length > 1 || groups.length > 0) && (
        <div className="chart-controls">
          {ranges.length > 1 && (
            <Segmented label="Período do gráfico" options={ranges} value={range?.id} onChange={setRangeId} />
          )}
          {groups.length > 0 && <ComparePicker groups={groups} picked={picked} onPick={(t) => setPicked(addPicked(picked, t))} />}
        </div>
      )}
      {picked.length > 0 && <CompareChips picked={picked} onRemove={(p) => setPicked(picked.filter((x) => x !== p))} />}
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
