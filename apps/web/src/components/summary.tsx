import type { DatasetDescriptor } from '@sb/core';
import type { Summary } from '../controllers/summarize.ts';
import { useSummaryData } from '../hooks/useSummary.ts';

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

/** Busca e mostra as frases de resumo de um indicador. Nada enquanto carrega. */
export function DatasetSummary({ d, size = 'lg' }: { d: DatasetDescriptor; size?: 'md' | 'lg' }) {
  const s = useSummaryData(d);
  return s ? <SummaryText summary={s} size={size} /> : null;
}
