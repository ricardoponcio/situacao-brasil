import type { DatasetDescriptor } from '@sb/core';
import { api } from '../lib/api.ts';
import { summarize, summaryQuery, type Summary } from '../lib/summarize.ts';
import { useAsync, type AsyncState } from '../lib/useAsync.ts';

export function useSummary(d: DatasetDescriptor | undefined): AsyncState<Summary | null> {
  return useAsync(async () => {
    if (!d) return null;
    const { records } = await api.records(d.id, summaryQuery(d));
    return summarize(d, records);
  }, [d?.id]);
}

/** Frases do resumo: a primeira em destaque, as de contexto logo abaixo. */
export function SummaryText({ summary, size = 'md' }: { summary: Summary; size?: 'md' | 'lg' }) {
  const [main, ...context] = summary.sentences;
  if (!main) return null;
  return (
    <div className={`summary summary-${size}`}>
      <p className="summary-main">{main}</p>
      {context.map((c) => (
        <p key={c} className="summary-context">
          {c}
        </p>
      ))}
    </div>
  );
}
