import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type {
  DatasetDescriptor,
  DatasetStats,
  RawBlobInfo,
  RecordKind,
  RunSummary,
  SbRecord,
  SourceManifest,
  TerritoryLevel,
} from '@sb/core';
import { timeKeyOf } from '@sb/core';

type Row = Record<string, SQLInputValue>;

const nowIso = () => new Date().toISOString();

export class CatalogRepository {
  constructor(private readonly db: DatabaseSync) {}

  upsertSource(manifest: SourceManifest): void {
    this.db
      .prepare(
        `INSERT INTO sources (id, manifest, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET manifest = excluded.manifest, updated_at = excluded.updated_at`,
      )
      .run(manifest.id, JSON.stringify(manifest), nowIso());
  }

  upsertDataset(d: DatasetDescriptor): void {
    this.db
      .prepare(
        `INSERT INTO datasets (id, source_id, descriptor, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET source_id = excluded.source_id,
           descriptor = excluded.descriptor, updated_at = excluded.updated_at`,
      )
      .run(d.id, d.sourceId, JSON.stringify(d), nowIso());
  }

  listSources(): SourceManifest[] {
    return this.db
      .prepare('SELECT manifest FROM sources ORDER BY id')
      .all()
      .map((r) => JSON.parse(String((r as Row).manifest)) as SourceManifest);
  }

  getSource(id: string): SourceManifest | null {
    const row = this.db.prepare('SELECT manifest FROM sources WHERE id = ?').get(id) as Row | undefined;
    return row ? (JSON.parse(String(row.manifest)) as SourceManifest) : null;
  }

  listDatasets(filter: { sourceId?: string } = {}): DatasetDescriptor[] {
    const rows = filter.sourceId
      ? this.db.prepare('SELECT descriptor FROM datasets WHERE source_id = ? ORDER BY id').all(filter.sourceId)
      : this.db.prepare('SELECT descriptor FROM datasets ORDER BY id').all();
    return rows.map((r) => JSON.parse(String((r as Row).descriptor)) as DatasetDescriptor);
  }

  getDataset(id: string): DatasetDescriptor | null {
    const row = this.db.prepare('SELECT descriptor FROM datasets WHERE id = ?').get(id) as Row | undefined;
    return row ? (JSON.parse(String(row.descriptor)) as DatasetDescriptor) : null;
  }
}

export interface RecordQuery {
  datasetId?: string;
  kind?: RecordKind;
  territoryLevel?: TerritoryLevel;
  territoryCode?: string;
  from?: string;
  to?: string;
  order?: 'asc' | 'desc';
  limit?: number;
}

export class RecordRepository {
  constructor(private readonly db: DatabaseSync) {}

  upsertMany(records: SbRecord[]): void {
    const stmt = this.db.prepare(
      `INSERT INTO records (id, dataset_id, kind, time_key, territory_level, territory_code, payload, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, time_key = excluded.time_key,
         territory_level = excluded.territory_level, territory_code = excluded.territory_code,
         fetched_at = excluded.fetched_at`,
    );
    this.db.exec('BEGIN');
    try {
      for (const r of records) {
        stmt.run(
          r.id,
          r.datasetId,
          r.kind,
          timeKeyOf(r),
          r.territory?.level ?? null,
          r.territory?.code ?? null,
          JSON.stringify(r),
          r.provenance.fetchedAt,
        );
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  query(q: RecordQuery): SbRecord[] {
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    const add = (sql: string, v: SQLInputValue | undefined) => {
      if (v === undefined) return;
      where.push(sql);
      params.push(v);
    };
    add('dataset_id = ?', q.datasetId);
    add('kind = ?', q.kind);
    add('territory_level = ?', q.territoryLevel);
    add('territory_code = ?', q.territoryCode);
    add('time_key >= ?', q.from);
    add('time_key <= ?', q.to);
    const order = q.order === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(q.limit ?? 500, 1), 10_000);
    const sql = `SELECT payload FROM records ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY time_key ${order} LIMIT ${limit}`;
    return this.db
      .prepare(sql)
      .all(...params)
      .map((r) => JSON.parse(String((r as Row).payload)) as SbRecord);
  }

  stats(datasetId: string): DatasetStats {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count, MIN(time_key) AS first, MAX(time_key) AS last, MAX(fetched_at) AS fetched
         FROM records WHERE dataset_id = ?`,
      )
      .get(datasetId) as Row;
    return {
      count: Number(row.count),
      firstTime: (row.first as string | null) ?? null,
      lastTime: (row.last as string | null) ?? null,
      lastFetchedAt: (row.fetched as string | null) ?? null,
    };
  }
}

export class RunRepository {
  constructor(private readonly db: DatabaseSync) {}

  start(sourceId: string): number {
    const res = this.db
      .prepare(`INSERT INTO runs (source_id, started_at, status) VALUES (?, ?, 'running')`)
      .run(sourceId, nowIso());
    return Number(res.lastInsertRowid);
  }

  finish(id: number, status: RunSummary['status'], recordsCount: number, issues: string[]): void {
    this.db
      .prepare(`UPDATE runs SET finished_at = ?, status = ?, records_count = ?, issues = ? WHERE id = ?`)
      .run(nowIso(), status, recordsCount, JSON.stringify(issues), id);
  }

  list(sourceId?: string, limit = 20): RunSummary[] {
    const rows = sourceId
      ? this.db.prepare('SELECT * FROM runs WHERE source_id = ? ORDER BY id DESC LIMIT ?').all(sourceId, limit)
      : this.db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?').all(limit);
    return rows.map((r) => toRun(r as Row));
  }

  last(sourceId: string): RunSummary | null {
    return this.list(sourceId, 1)[0] ?? null;
  }
}

function toRun(r: Row): RunSummary {
  return {
    id: Number(r.id),
    sourceId: String(r.source_id),
    startedAt: String(r.started_at),
    finishedAt: (r.finished_at as string | null) ?? null,
    status: r.status as RunSummary['status'],
    recordsCount: Number(r.records_count),
    issues: JSON.parse(String(r.issues)) as string[],
  };
}

export class RawBlobRepository {
  constructor(private readonly db: DatabaseSync) {}

  register(info: RawBlobInfo): void {
    this.db
      .prepare(
        `INSERT INTO raw_blobs (hash, url, fetched_at, bytes, content_type) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(hash) DO NOTHING`,
      )
      .run(info.hash, info.url, info.fetchedAt, info.bytes, info.contentType);
  }

  get(hash: string): RawBlobInfo | null {
    const r = this.db.prepare('SELECT * FROM raw_blobs WHERE hash = ?').get(hash) as Row | undefined;
    if (!r) return null;
    return {
      hash: String(r.hash),
      url: String(r.url),
      fetchedAt: String(r.fetched_at),
      bytes: Number(r.bytes),
      contentType: String(r.content_type),
    };
  }
}
