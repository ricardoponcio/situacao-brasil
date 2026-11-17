/** Listas de eventos: a simples (sem assunto) e a linha do tempo da proposta. */
import type { Event } from '@sb/core';
import { formatDate, formatDateTime } from '../../lib/format.ts';
import { ExternalLinks } from '../ui.tsx';
import { DecidedByChip, OutcomePill } from './Selos.tsx';

/** Lista simples, para eventos sem assunto. */
export function EventList({ events }: { events: Event[] }) {
  if (!events.length) return <p className="muted">Nada registrado no período coletado.</p>;
  return (
    <ul className="feed">
      {events.map((e) => (
        <li key={e.id}>
          <div className="feed-meta">
            <time dateTime={e.occurredAt}>{formatDateTime(e.occurredAt)}</time>
            <OutcomePill outcome={e.outcome} />
          </div>
          <p className="feed-title">{e.title}</p>
          <ExternalLinks links={e.links} />
        </li>
      ))}
    </ul>
  );
}

/** Votações e decisões em ordem, com quem decidiu e o resultado. */
export function Timeline({ events }: { events: Event[] }) {
  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={e.id} className={`actor-${e.decidedBy ?? 'resultado'}`}>
          <div className="feed-meta">
            <time dateTime={e.occurredAt}>{formatDate(e.occurredAt.slice(0, 10))}</time>
            <DecidedByChip who={e.decidedBy} />
            <OutcomePill outcome={e.outcome} />
          </div>
          <p className="timeline-title">{e.title}</p>
          {e.summary && <p className="muted timeline-title">{e.summary}</p>}
          <ExternalLinks links={e.links} />
        </li>
      ))}
    </ol>
  );
}
