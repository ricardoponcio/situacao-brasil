/** Onde a proposta está: "agora" e "próximo passo", vetos e a última votação. */
import type { Event } from '@sb/core';
import { ACTORS } from '../../content/legislativeProcesses.ts';
import { formatDate } from '../../lib/format.ts';
import { vetoLinhas, type Status } from '../../controllers/propostas.ts';
import { DecidedByChip, OutcomePill } from './Selos.tsx';

/** Onde a proposta está agora e o que falta. Aprovar uma votação não é o fim do caminho. */
export function SubjectProgress({ status }: { status: Status }) {
  const rows: [string, Status['now']][] = [['Agora', status.now]];
  if (status.next) rows.push(['Próximo passo', status.next]);
  return (
    <dl className={`vote-progress ${status.done ? 'is-done' : ''}`}>
      {rows.map(([term, stage]) => (
        <div key={term} className="vote-progress-row">
          <dt>{term}</dt>
          <dd>
            <span className={`actor-chip actor-${stage.where}`}>{ACTORS[stage.where].label}</span>
            <span>{stage.label}</span>
          </dd>
        </div>
      ))}
      {status.done && (
        <div className="vote-progress-row">
          <dt>Próximo passo</dt>
          <dd className="muted">Nenhum. O caminho desta proposta terminou.</dd>
        </div>
      )}
    </dl>
  );
}

/** "Vetado em parte (VET 3/2026). Esperando o Congresso analisar o veto." Uma linha por veto do projeto. */
export function VetoNote({ events }: { events: Event[] }) {
  return (
    <>
      {vetoLinhas(events).map((v) => (
        <p key={v.key} className="veto-note">
          <span className="actor-chip actor-presidencia">Veto</span>
          <span>
            {v.what} ({v.label}
            {v.date ? `, em ${formatDate(v.date)}` : ''}).{' '}
            {v.status && `${v.status.now.label}.`}
          </span>
        </p>
      ))}
    </>
  );
}

/** Como chamar o registro mais recente do grupo, pela categoria do evento. */
const LAST_LABEL: Record<string, string> = {
  'decisao-final': 'Decisão final em',
  veto: 'Vetado em',
};

/** "Última votação em 15/10/2026: Aprovada", com quem decidiu. */
export function LastRecord({ event }: { event: Event }) {
  return (
    <div className="vote-status">
      <DecidedByChip who={event.decidedBy} />
      <span>
        {LAST_LABEL[event.category] ?? 'Última votação em'} {formatDate(event.occurredAt.slice(0, 10))}
        {event.category === 'procedimento' ? ' (um pedido sobre o andamento, não o texto)' : ''}:
      </span>
      <OutcomePill outcome={event.outcome} />
    </div>
  );
}
