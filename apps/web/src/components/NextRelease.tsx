import type { DatasetDescriptor } from '@sb/core';
import { formatDate } from '../lib/format.ts';
import { useNextRelease } from '../hooks/useDatasets.ts';

/** "Próximo dado: 12/11/2026 (out/2026)", lido do calendário de divulgações da origem. */
export function NextRelease({ descriptor }: { descriptor: DatasetDescriptor }) {
  const next = useNextRelease(descriptor);
  if (!next) return null;
  return (
    <span className="next-release">
      Próximo dado: {formatDate(next.date)}
      {next.referencia ? ` (${next.referencia})` : ''}
    </span>
  );
}
