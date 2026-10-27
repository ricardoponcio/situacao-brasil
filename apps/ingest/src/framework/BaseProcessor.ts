import {
  DatasetDescriptor,
  SbRecord,
  SourceManifest,
  type DatasetDescriptorInput,
  type RecordDraft,
  type SourceManifestInput,
} from '@sb/core';
import type { Origin } from './HttpClient.ts';
import type { Processor, RunContext } from './Processor.ts';

/** O que uma subclasse emite: o rascunho do registro + de onde ele veio. */
export interface Emission {
  datasetId: string;
  origin: Origin;
  draft: RecordDraft;
}

/**
 * Base de todos os processadores. A subclasse só precisa:
 *  1. passar o manifesto da fonte no construtor;
 *  2. declarar os datasets em `datasets()` (use `this.describe`);
 *  3. implementar `collect()`, emitindo rascunhos com `this.emit`.
 *
 * A base cuida de proveniência, validação contra as DTOs e relato de problemas.
 */
export abstract class BaseProcessor implements Processor {
  readonly manifest: SourceManifest;

  protected constructor(
    manifest: SourceManifestInput,
    readonly version: string,
  ) {
    this.manifest = SourceManifest.parse(manifest);
  }

  abstract datasets(): DatasetDescriptor[];

  protected abstract collect(ctx: RunContext): AsyncIterable<Emission>;

  get processorId(): string {
    return `${this.constructor.name}@${this.version}`;
  }

  async *run(ctx: RunContext): AsyncIterable<SbRecord> {
    const known = new Set(this.datasets().map((d) => d.id));
    for await (const e of this.collect(ctx)) {
      if (!known.has(e.datasetId)) {
        ctx.issue(`dataset não declarado: ${e.datasetId}`);
        continue;
      }
      const parsed = SbRecord.safeParse({
        ...e.draft,
        datasetId: e.datasetId,
        provenance: {
          sourceId: this.manifest.id,
          datasetId: e.datasetId,
          processor: this.processorId,
          fetchedAt: e.origin.fetchedAt,
          originUrl: e.origin.url,
          rawHash: e.origin.rawHash,
        },
      });
      if (!parsed.success) {
        ctx.issue(`registro inválido em ${e.datasetId} (${e.draft.id}): ${parsed.error.issues[0]?.message}`);
        continue;
      }
      yield parsed.data;
    }
  }

  protected describe(input: Omit<DatasetDescriptorInput, 'sourceId'>): DatasetDescriptor {
    return DatasetDescriptor.parse({ ...input, sourceId: this.manifest.id });
  }

  protected emit(datasetId: string, origin: Origin, draft: RecordDraft): Emission {
    return { datasetId, origin, draft };
  }
}
