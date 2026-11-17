import type { DatasetDescriptor } from '@sb/core';
import { api, type RecordsParams } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import { companionsOf } from '../controllers/assuntos.ts';
import { nextReleaseOf } from '../controllers/registros.ts';

/** Catálogo inteiro (descriptor + estatísticas). O cliente guarda em cache: todas as telas dividem a mesma busca. */
export const useDatasets = () => useAsync(() => api.datasets(), []);

/** Um dataset: descriptor, fonte e estatísticas. */
export const useDataset = (id: string) => useAsync(() => api.dataset(id), [id]);

/** Registros de um dataset, com a consulta dada. Refaz a busca quando muda o dataset ou `key`. */
export const useRecords = (id: string, params: RecordsParams, key: unknown = '') => useAsync(() => api.records(id, params), [id, key]);

/** Todas as fontes, com os dados e a última coleta de cada uma. */
export const useSources = () => useAsync(() => api.sources(), []);

/** Uma fonte, com os dados e o histórico de coletas. */
export const useSource = (id: string) => useAsync(() => api.source(id), [id]);

/** Resolve os "leia junto" de um dataset para descriptors completos. Vazio enquanto carrega. */
export function useCompanions(d: DatasetDescriptor | undefined): DatasetDescriptor[] {
  const all = useDatasets();
  if (all.status !== 'ok') return [];
  return companionsOf(
    d,
    all.data.map((i) => i.descriptor),
  );
}

/** Próxima divulgação do indicador, lida do calendário da origem. */
export function useNextRelease(descriptor: DatasetDescriptor) {
  const cal = descriptor.nextRelease;
  // Mesma consulta para todos os indicadores da tela (o cliente guarda em cache).
  const today = new Date().toISOString().slice(0, 10);
  const state = useAsync(
    () => (cal ? api.records(cal.datasetId, { from: today, order: 'asc', limit: 500 }) : Promise.resolve(null)),
    [cal?.datasetId, today],
  );
  if (!cal || state.status !== 'ok' || !state.data) return undefined;
  return nextReleaseOf(state.data.records, cal.key);
}
