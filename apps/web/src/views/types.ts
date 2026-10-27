import type { ComponentType } from 'react';
import type { DatasetDescriptor, SbRecord } from '@sb/core';
import type { RecordsParams } from '../lib/api.ts';

export type ViewMode = 'card' | 'full';

export interface ViewProps {
  descriptor: DatasetDescriptor;
  /** Registros do dataset; a view filtra os do tipo que entende. */
  records: SbRecord[];
  mode: ViewMode;
}

/**
 * Uma view sabe (1) que dados pedir à API e (2) como mostrá-los, para QUALQUER
 * dataset do seu tipo. Nenhuma view conhece um dataset específico: o que muda
 * vem de `descriptor.view.options`.
 */
export interface ViewDefinition {
  query(descriptor: DatasetDescriptor, mode: ViewMode): RecordsParams;
  component: ComponentType<ViewProps>;
}
