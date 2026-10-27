import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './Database.ts';
import { CatalogRepository, RawBlobRepository, RecordRepository, RunRepository } from './repositories.ts';
import { RawStore } from './RawStore.ts';

export * from './repositories.ts';
export * from './RawStore.ts';
export * from './paths.ts';
export { openDatabase };

/** Ponto único de acesso ao armazenamento, usado por ingest e api. */
export class Storage {
  readonly catalog: CatalogRepository;
  readonly records: RecordRepository;
  readonly runs: RunRepository;
  readonly raw: RawStore;

  constructor(readonly db: DatabaseSync = openDatabase()) {
    this.catalog = new CatalogRepository(db);
    this.records = new RecordRepository(db);
    this.runs = new RunRepository(db);
    this.raw = new RawStore(new RawBlobRepository(db));
  }

  close(): void {
    this.db.close();
  }
}
