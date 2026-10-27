import type { SbRecord } from '@sb/core';
import type { Storage } from '@sb/storage';
import { HttpClient } from './HttpClient.ts';
import type { Processor, RunContext } from './Processor.ts';

const BATCH = 500;

export interface RunOutcome {
  sourceId: string;
  status: 'ok' | 'partial' | 'error';
  records: number;
  issues: string[];
}

/** Executa processadores e grava catálogo, registros e o log da execução. */
export class Runner {
  constructor(
    private readonly storage: Storage,
    private readonly options: Record<string, string> = {},
  ) {}

  async run(p: Processor): Promise<RunOutcome> {
    const sourceId = p.manifest.id;
    this.storage.catalog.upsertSource(p.manifest);
    for (const d of p.datasets()) this.storage.catalog.upsertDataset(d);

    const runId = this.storage.runs.start(sourceId);
    const issues: string[] = [];
    const ctx: RunContext = {
      http: new HttpClient(this.storage.raw),
      options: this.options,
      log: (m) => console.log(`  [${sourceId}] ${m}`),
      issue: (m) => {
        issues.push(m);
        console.warn(`  [${sourceId}] ! ${m}`);
      },
    };

    let count = 0;
    let buffer: SbRecord[] = [];
    const flush = () => {
      if (!buffer.length) return;
      this.storage.records.upsertMany(buffer);
      count += buffer.length;
      buffer = [];
    };

    try {
      for await (const record of p.run(ctx)) {
        buffer.push(record);
        if (buffer.length >= BATCH) flush();
      }
      flush();
      const status = issues.length ? 'partial' : 'ok';
      this.storage.runs.finish(runId, status, count, issues.slice(0, 200));
      return { sourceId, status, records: count, issues };
    } catch (err) {
      flush();
      const msg = err instanceof Error ? err.message : String(err);
      issues.push(`FATAL: ${msg}`);
      this.storage.runs.finish(runId, 'error', count, issues.slice(0, 200));
      return { sourceId, status: 'error', records: count, issues };
    }
  }
}
