/** Formatos de resposta da API, compartilhados entre back e front. */
import type { DatasetDescriptor, SourceManifest } from './catalog.ts';
import type { SbRecord } from './records.ts';

export interface RunSummary {
  id: number;
  sourceId: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'ok' | 'partial' | 'error';
  recordsCount: number;
  issues: string[];
}

export interface DatasetStats {
  count: number;
  firstTime: string | null;
  lastTime: string | null;
  lastFetchedAt: string | null;
}

export interface SourceSummary {
  manifest: SourceManifest;
  datasets: DatasetDescriptor[];
  lastRun: RunSummary | null;
}

export interface DatasetDetail {
  descriptor: DatasetDescriptor;
  source: SourceManifest;
  stats: DatasetStats;
}

export interface RecordsResponse<R extends SbRecord = SbRecord> {
  datasetId: string;
  records: R[];
}

export interface RawBlobInfo {
  hash: string;
  url: string;
  fetchedAt: string;
  bytes: number;
  contentType: string;
}
