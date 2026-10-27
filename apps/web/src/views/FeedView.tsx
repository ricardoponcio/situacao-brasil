import type { Event } from '@sb/core';
import { Pill, type Tone } from '../components/ui.tsx';
import { formatDate, formatDateTime } from '../lib/format.ts';
import { ACTORS } from '../content/legislativeProcesses.ts';
import { PROPOSITION_TYPES, ementaGist, openProcess } from '../content/propositionTypes.ts';
import type { ViewDefinition, ViewProps } from './types.ts';

const OUTCOME: Record<string, { tone: Tone; icon: string; label: string }> = {
  aprovada: { tone: 'good', icon: '✓', label: 'Aprovada' },
  aprovado: { tone: 'good', icon: '✓', label: 'Aprovado' },
  rejeitada: { tone: 'bad', icon: '✕', label: 'Rejeitada' },
  rejeitado: { tone: 'bad', icon: '✕', label: 'Rejeitado' },
  mantido: { tone: 'neutral', icon: '•', label: 'Veto mantido' },
  derrubado: { tone: 'neutral', icon: '•', label: 'Veto derrubado' },
};

function OutcomePill({ outcome }: { outcome?: string }) {
  if (!outcome) return null;
  const o = OUTCOME[outcome];
  return o ? (
    <Pill tone={o.tone} icon={o.icon}>
      {o.label}
    </Pill>
  ) : (
    <Pill tone="neutral">{outcome}</Pill>
  );
}

function DecidedByChip({ who }: { who?: Event['decidedBy'] }) {
  return who ? <span className={`actor-chip actor-${who}`}>{ACTORS[who].label}</span> : null;
}

/** Selo cinza com a sigla. Se existir diagrama para o tipo, abre a explicação na aba certa. */
export function TypeBadge({ kind }: { kind: string }) {
  const t = PROPOSITION_TYPES[kind];
  const content = (
    <>
      <strong>{kind}</strong>
      {t && <span className="type-name">{t.name}</span>}
    </>
  );
  if (!t?.processId) return <span className="type-badge">{content}</span>;
  const processId = t.processId;
  return (
    <button className="type-badge" title={`Como funciona: ${t.name}`} onClick={() => openProcess(processId)}>
      {content}
      <span className="type-help" aria-hidden>
        ?
      </span>
    </button>
  );
}

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
          {e.links.length > 0 && (
            <div className="feed-links">
              {e.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

interface Group {
  subject: NonNullable<Event['subject']>;
  events: Event[]; // mais recente primeiro
}

/** Um assunto (ex.: um projeto de lei) com todas as votações sobre ele. */
function SubjectGroup({ g }: { g: Group }) {
  const last = g.events[0]!;
  const gist = ementaGist(g.subject.title);
  return (
    <li className={`vote-group actor-${last.decidedBy ?? 'proponente'}`}>
      <div className="vote-meta">
        <TypeBadge kind={g.subject.kind} />
        <span className="muted">{g.subject.label}</span>
      </div>
      <p className="vote-title">{gist ?? g.subject.title}</p>
      <div className="vote-status">
        <DecidedByChip who={last.decidedBy} />
        <span>Última votação em {formatDate(last.occurredAt.slice(0, 10))}:</span>
        <OutcomePill outcome={last.outcome} />
      </div>
      {gist && (
        <details className="vote-more">
          <summary>Texto oficial (ementa)</summary>
          <p>{g.subject.title}</p>
        </details>
      )}
      <details className="vote-more">
        <summary>
          {g.events.length === 1 ? 'Ver a votação' : `Ver as ${g.events.length} votações sobre esta proposta`}
        </summary>
        <EventList events={g.events} />
      </details>
      {g.subject.url && (
        <a className="vote-link" href={g.subject.url} target="_blank" rel="noreferrer">
          Tramitação completa no site da Câmara
        </a>
      )}
    </li>
  );
}

/** Agrupa por assunto; eventos sem assunto ficam numa lista à parte. */
export function SubjectFeed({ events }: { events: Event[] }) {
  const groups = new Map<string, Group>();
  const loose: Event[] = [];
  for (const e of [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
    if (!e.subject) {
      loose.push(e);
      continue;
    }
    const g = groups.get(e.subject.id) ?? { subject: e.subject, events: [] };
    g.events.push(e);
    groups.set(e.subject.id, g);
  }
  if (!groups.size) return <EventList events={loose} />;
  return (
    <>
      <ul className="vote-groups">
        {[...groups.values()].map((g) => (
          <SubjectGroup key={g.subject.id} g={g} />
        ))}
      </ul>
      {loose.length > 0 && (
        <details className="vote-more">
          <summary>Outras votações ({loose.length})</summary>
          <EventList events={loose} />
        </details>
      )}
    </>
  );
}

function Feed({ records, descriptor }: ViewProps) {
  const events = records.filter((r): r is Event => r.kind === 'event');
  return descriptor.view.options.groupBySubject ? <SubjectFeed events={events} /> : <EventList events={events} />;
}

export const feedView: ViewDefinition = {
  query: (_d, mode) => ({ order: 'desc', limit: mode === 'card' ? 6 : 300 }),
  component: Feed,
};
