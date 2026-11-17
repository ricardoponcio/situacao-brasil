import type { DatasetDescriptor } from '@sb/core';
import { api } from '../lib/api.ts';
import { useAsync, type AsyncState } from '../lib/useAsync.ts';
import { summarize, summaryQuery, type Summary } from '../controllers/summarize.ts';

/** Frases e número de resumo de um indicador (busca os registros que o resumo precisa). */
export function useSummary(d: DatasetDescriptor | undefined): AsyncState<Summary | null> {
  return useAsync(async () => {
    if (!d) return null;
    const { records } = await api.records(d.id, summaryQuery(d));
    return summarize(d, records);
  }, [d?.id]);
}

/** O resumo pronto, ou `null` enquanto carrega, se falhar ou se não houver. */
export function useSummaryData(d: DatasetDescriptor | undefined): Summary | null {
  const s = useSummary(d);
  return s.status === 'ok' ? s.data : null;
}
