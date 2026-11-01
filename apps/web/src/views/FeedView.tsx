import { useMemo, useState } from 'react';
import { refLabel, type Event, type PropostaResumo } from '@sb/core';
import { Pill, type Tone } from '../components/ui.tsx';
import { ResumoIA, casaOf, pickResumo, useResumos } from '../components/Resumo.tsx';
import { api } from '../lib/api.ts';
import { href } from '../lib/router.ts';
import { useAsync } from '../lib/useAsync.ts';
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
  'perdeu-validade': { tone: 'neutral', icon: '•', label: 'Perdeu a validade' },
  prejudicada: { tone: 'neutral', icon: '•', label: 'Prejudicada' },
  retirada: { tone: 'neutral', icon: '•', label: 'Retirada' },
  'veto-total': { tone: 'neutral', icon: '•', label: 'Veto total' },
  'veto-parcial': { tone: 'neutral', icon: '•', label: 'Veto parcial' },
  'mantido-em-parte': { tone: 'neutral', icon: '•', label: 'Veto mantido em parte' },
};

/** Como chamar o registro mais recente do grupo, pela categoria do evento. */
const LAST_LABEL: Record<string, string> = {
  'decisao-final': 'Decisão final em',
  veto: 'Vetado em',
};
const VOTE_CATEGORIES = new Set(['votacao-plenario', 'procedimento', 'votacao-nominal']);

/** Site onde a proposta tem a tramitação completa, pelo prefixo do id do assunto. */
export const SUBJECT_SITE: Record<string, string> = {
  'camara-proposicao': 'Tramitação completa no site da Câmara',
  'senado-processo': 'Tramitação completa no site do Senado',
};

export function OutcomePill({ outcome }: { outcome?: string }) {
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

export function DecidedByChip({ who }: { who?: Event['decidedBy'] }) {
  return who ? <span className={`actor-chip actor-${who}`}>{ACTORS[who].label}</span> : null;
}

type Status = NonNullable<NonNullable<Event['subject']>['status']>;

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

/** A situação mais recente entre as votações do grupo (cada coleta grava a situação do momento). */
export function latestStatus(events: Event[]): Status | undefined {
  let best: Event | undefined;
  for (const e of events) {
    if (e.subject?.status && (!best || e.provenance.fetchedAt > best.provenance.fetchedAt)) best = e;
  }
  return best?.subject?.status;
}

const VETOS_DATASET = 'congresso-vetos';

/** Eventos de veto agrupados pelo projeto vetado (`subject.ref`). Só busca quando a lista tem propostas com chave. */
function useVetosByRef(enabled: boolean): Map<string, Event[]> {
  const state = useAsync(() => (enabled ? api.records(VETOS_DATASET, { limit: 1000 }) : Promise.resolve(null)), [enabled]);
  return useMemo(() => {
    const map = new Map<string, Event[]>();
    if (state.status !== 'ok' || !state.data) return map;
    for (const r of state.data.records) {
      if (r.kind !== 'event' || !r.subject?.ref) continue;
      map.set(r.subject.ref, [...(map.get(r.subject.ref) ?? []), r]);
    }
    return map;
  }, [state]);
}

/** "Vetado em parte (VET 3/2026). Esperando o Congresso analisar o veto." Uma linha por veto do projeto. */
export function VetoNote({ events }: { events: Event[] }) {
  const byVeto = new Map<string, Event[]>();
  for (const e of events) byVeto.set(e.subject!.id, [...(byVeto.get(e.subject!.id) ?? []), e]);
  return (
    <>
      {[...byVeto.values()].map((evs) => {
        const aposto = evs.find((e) => e.category === 'veto');
        const status = latestStatus(evs);
        const what = aposto?.outcome === 'veto-total' ? 'O Presidente vetou o projeto inteiro' : 'O Presidente vetou parte do projeto';
        return (
          <p key={evs[0]!.subject!.id} className="veto-note">
            <span className="actor-chip actor-presidencia">Veto</span>
            <span>
              {what} ({evs[0]!.subject!.label}
              {aposto ? `, em ${formatDate(aposto.occurredAt.slice(0, 10))}` : ''}).{' '}
              {status && `${status.now.label}.`}
            </span>
          </p>
        );
      })}
    </>
  );
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
function SubjectGroup({ g, vetos, resumos }: { g: Group; vetos?: Event[]; resumos?: PropostaResumo[] }) {
  const last = g.events[0]!;
  const ref = g.subject.ref;
  const isVeto = g.subject.kind === 'VET';
  const gist = ementaGist(g.subject.title);
  // Num veto, o resumo seria do projeto vetado, não do veto: fica para a página da proposta.
  const resumo = isVeto ? undefined : pickResumo(resumos, casaOf(g.subject.id));
  const status = latestStatus(g.events);
  return (
    <li className={`vote-group actor-${status?.now.where ?? last.decidedBy ?? 'proponente'}`}>
      <div className="vote-meta">
        <TypeBadge kind={g.subject.kind} />
        <span className="muted">{g.subject.label}</span>
        {isVeto && ref && (
          <span>
            Projeto vetado: <a href={href.proposta(ref)}>{refLabel(ref)}</a>
          </span>
        )}
      </div>
      <p className="vote-title">{resumo?.titulo ?? gist ?? g.subject.title}</p>
      {resumo && <ResumoIA resumo={resumo} />}
      {status && <SubjectProgress status={status} />}
      {!isVeto && vetos && <VetoNote events={vetos} />}
      <div className="vote-status">
        <DecidedByChip who={last.decidedBy} />
        <span>
          {LAST_LABEL[last.category] ?? 'Última votação em'} {formatDate(last.occurredAt.slice(0, 10))}
          {last.category === 'procedimento' ? ' (um pedido sobre o andamento, não o texto)' : ''}:
        </span>
        <OutcomePill outcome={last.outcome} />
      </div>
      {(gist || resumo) && (
        <details className="vote-more">
          <summary>Texto oficial (ementa)</summary>
          <p>{g.subject.title}</p>
        </details>
      )}
      <details className="vote-more">
        <summary>
          {g.events.every((e) => VOTE_CATEGORIES.has(e.category))
            ? g.events.length === 1
              ? 'Ver a votação'
              : `Ver as ${g.events.length} votações sobre esta proposta`
            : g.events.length === 1
              ? 'Ver o registro'
              : `Ver os ${g.events.length} registros sobre esta proposta`}
        </summary>
        <EventList events={g.events} />
      </details>
      <div className="vote-links">
        {ref && (
          <a className="vote-link" href={href.proposta(ref)}>
            {isVeto ? 'Ver a história do projeto vetado' : 'Ver tudo sobre esta proposta (Câmara, Senado e vetos)'}
          </a>
        )}
        {g.subject.url && (
          <a className="vote-link" href={g.subject.url} target="_blank" rel="noreferrer">
            {SUBJECT_SITE[g.subject.id.split(':')[0]!] ?? 'Tramitação completa'}
          </a>
        )}
      </div>
    </li>
  );
}

/** Quantas propostas aparecem de início; o resto fica atrás de "Mostrar mais" (listas longas cansam, no celular mais ainda). */
const PAGE = 8;

/** Agrupa por assunto; eventos sem assunto ficam numa lista à parte. */
export function SubjectFeed({ events }: { events: Event[] }) {
  const [shown, setShown] = useState(PAGE);
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
  const all = [...groups.values()];
  const vetos = useVetosByRef(all.some((g) => g.subject.ref && g.subject.kind !== 'VET'));
  const resumos = useResumos(all.flatMap((g) => (g.subject.ref && g.subject.kind !== 'VET' ? [g.subject.ref] : [])));
  if (!groups.size) return <EventList events={loose} />;
  return (
    <>
      <ul className="vote-groups">
        {all.slice(0, shown).map((g) => (
          <SubjectGroup
            key={g.subject.id}
            g={g}
            vetos={g.subject.ref ? vetos.get(g.subject.ref) : undefined}
            resumos={g.subject.ref ? resumos.get(g.subject.ref) : undefined}
          />
        ))}
      </ul>
      {groups.size > shown && (
        <button className="show-more" onClick={() => setShown((n) => n + PAGE * 2)}>
          Mostrar mais {Math.min(PAGE * 2, groups.size - shown)} (de {groups.size - shown} restantes)
        </button>
      )}
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
