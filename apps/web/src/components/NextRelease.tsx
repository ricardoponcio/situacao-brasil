import type { DatasetDescriptor, Event } from '@sb/core';
import { api } from '../lib/api.ts';
import { formatDate } from '../lib/format.ts';
import { useAsync } from '../lib/useAsync.ts';

/** "Próximo dado: 12/11/2026 (out/2026)", lido do calendário de divulgações da origem. */
export function NextRelease({ descriptor }: { descriptor: DatasetDescriptor }) {
  const cal = descriptor.nextRelease;
  // Mesma consulta para todos os indicadores da tela (o cliente guarda em cache).
  const today = new Date().toISOString().slice(0, 10);
  const state = useAsync(
    () => (cal ? api.records(cal.datasetId, { from: today, order: 'asc', limit: 500 }) : Promise.resolve(null)),
    [cal?.datasetId, today],
  );
  if (!cal || state.status !== 'ok' || !state.data) return null;
  const next = state.data.records.find(
    (r): r is Event => r.kind === 'event' && r.attributes.chave === cal.key && r.occurredAt >= new Date().toISOString(),
  );
  if (!next) return null;
  const ref = next.attributes.referencia;
  return (
    <span className="next-release">
      Próximo dado: {formatDate(next.occurredAt.slice(0, 10))}
      {typeof ref === 'string' ? ` (${ref})` : ''}
    </span>
  );
}
