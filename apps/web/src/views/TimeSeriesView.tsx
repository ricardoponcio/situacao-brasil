import { TimeSeries } from '../components/series/TimeSeries.tsx';
import type { ViewDefinition } from './types.ts';

export const timeSeriesView: ViewDefinition = {
  // Padrão: Brasil inteiro, os 120 períodos mais recentes (a view reordena cronologicamente).
  query: () => ({ level: 'pais', territory: '1', order: 'desc', limit: 120 }),
  component: TimeSeries,
};
