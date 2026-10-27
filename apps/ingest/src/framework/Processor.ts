import type { DatasetDescriptor, SbRecord, SourceManifest } from '@sb/core';
import type { HttpClient } from './HttpClient.ts';

export interface RunContext {
  http: HttpClient;
  /** Opções vindas da CLI (--opt chave=valor), para ajustar janelas de coleta etc. */
  options: Readonly<Record<string, string>>;
  log(message: string): void;
  /** Problema não fatal: o registro é descartado e a execução fica "partial". */
  issue(message: string): void;
}

/**
 * Contrato de toda fonte. O resto do sistema (runner, api, front) só conhece isto.
 * Normalmente você não implementa direto: estenda BaseProcessor.
 */
export interface Processor {
  readonly manifest: SourceManifest;
  readonly version: string;
  datasets(): DatasetDescriptor[];
  run(ctx: RunContext): AsyncIterable<SbRecord>;
}
