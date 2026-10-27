import { DatasetDescriptor as DescriptorSchema } from '@sb/core';
import type {
  DatasetDescriptor,
  DatasetDetail,
  DatasetStats,
  RecordsResponse,
  RunSummary,
  SbRecord,
  SourceSummary,
} from '@sb/core';

const cache = new Map<string, Promise<unknown>>();

/** GET com cache em memória: várias partes da tela podem pedir o mesmo dado sem repetir a chamada. */
function get<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetchJson<T>(path);
    cache.set(path, p);
    p.catch(() => cache.delete(path));
  }
  return p;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface RecordsParams {
  level?: string;
  territory?: string;
  from?: string;
  to?: string;
  order?: 'asc' | 'desc';
  limit?: number;
}

export const api = {
  // Descriptors passam pelo schema do core: campos novos ganham o valor padrão mesmo
  // quando o banco foi gravado por uma versão anterior.
  datasets: () =>
    get<{ descriptor: DatasetDescriptor; stats: DatasetStats }[]>('/datasets').then((list) =>
      list.map((i) => ({ ...i, descriptor: DescriptorSchema.parse(i.descriptor) })),
    ),
  dataset: (id: string) =>
    get<DatasetDetail>(`/datasets/${encodeURIComponent(id)}`).then((d) => ({
      ...d,
      descriptor: DescriptorSchema.parse(d.descriptor),
    })),
  records: (id: string, p: RecordsParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(p).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
    );
    return get<RecordsResponse>(`/datasets/${encodeURIComponent(id)}/records?${qs}`);
  },
  feed: (limit = 50) => get<SbRecord[]>(`/feed?limit=${limit}`),
  sources: () => get<SourceSummary[]>('/sources'),
  source: (id: string) => get<SourceSummary & { runs: RunSummary[] }>(`/sources/${encodeURIComponent(id)}`),
  rawUrl: (hash: string) => `/api/raw/${hash}`,
};
