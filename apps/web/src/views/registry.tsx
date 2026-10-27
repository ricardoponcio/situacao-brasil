import type { DatasetDescriptor, ViewType } from '@sb/core';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import { Async } from '../components/ui.tsx';
import { feedView } from './FeedView.tsx';
import { tableView } from './TableView.tsx';
import { timeSeriesView } from './TimeSeriesView.tsx';
import type { ViewDefinition, ViewMode } from './types.ts';

/**
 * Tipo de view → implementação. Nova forma de visualizar = nova entrada aqui.
 * 'stat' reaproveita a série temporal (o número em destaque já faz parte dela).
 */
const VIEWS: Record<ViewType, ViewDefinition> = {
  timeseries: timeSeriesView,
  stat: timeSeriesView,
  feed: feedView,
  table: tableView,
};

/** Renderiza qualquer dataset a partir só do seu descriptor. */
export function DatasetView({ descriptor, mode }: { descriptor: DatasetDescriptor; mode: ViewMode }) {
  const view = VIEWS[descriptor.view.type];
  const params = view.query(descriptor, mode);
  const state = useAsync(() => api.records(descriptor.id, params), [descriptor.id, mode]);
  const Component = view.component;
  return (
    <Async state={state}>{(data) => <Component descriptor={descriptor} records={data.records} mode={mode} />}</Async>
  );
}
