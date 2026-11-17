import { useRef } from 'react';
import type { DatasetDescriptor } from '@sb/core';
import type { ChartPoint, ChartSeries } from '../components/charts/LineChart.tsx';
import { api } from '../lib/api.ts';
import { territoryKey } from '../lib/territories.ts';
import { useAsync, type AsyncState } from '../lib/useAsync.ts';
import { observations, toPoints, type Picked } from '../controllers/series.ts';

async function loadSeries(datasetId: string, level: string, territory: string): Promise<ChartPoint[]> {
  const { records } = await api.records(datasetId, { level, territory, order: 'desc', limit: 500 });
  return toPoints(observations(records));
}

/**
 * Linhas do gráfico: Brasil e cada território escolhido, com as cores dadas.
 * Enquanto carrega uma comparação nova, devolve as linhas anteriores (o gráfico não pula).
 */
export function useComparedSeries(
  descriptor: DatasetDescriptor,
  national: ChartPoint[],
  picked: Picked[],
  colors: { brasil: string; slots: string[] },
): { series: ChartSeries[]; state: AsyncState<ChartSeries[]> } {
  const terr = descriptor.territories;
  // Comparando, o Brasil vem do mesmo dataset dos estados (ex.: a série trimestral), para a conta ser a mesma.
  const compareId = terr?.datasetId ?? descriptor.id;
  const key = picked.map((p) => territoryKey(p.t)).join(',');
  const state = useAsync(async (): Promise<ChartSeries[]> => {
    const brasil = picked.length && terr?.datasetId ? await loadSeries(compareId, 'pais', '1') : national;
    const others = await Promise.all(picked.map((p) => loadSeries(compareId, p.t.level, p.t.code)));
    return [
      { id: 'brasil', label: 'Brasil', color: colors.brasil, points: brasil },
      ...picked.map((p, i) => ({ id: territoryKey(p.t), label: p.t.short, color: colors.slots[p.slot]!, points: others[i]! })),
    ];
  }, [descriptor.id, key]);

  const lastOk = useRef<ChartSeries[] | null>(null);
  if (state.status === 'ok') lastOk.current = state.data;
  return { series: lastOk.current ?? [{ id: 'brasil', label: 'Brasil', color: colors.brasil, points: national }], state };
}
