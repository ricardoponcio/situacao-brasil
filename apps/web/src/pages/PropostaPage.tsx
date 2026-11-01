import { refLabel, type Event } from '@sb/core';
import { api } from '../lib/api.ts';
import { formatDate } from '../lib/format.ts';
import { href } from '../lib/router.ts';
import { useAsync } from '../lib/useAsync.ts';
import { Async, Card, Section } from '../components/ui.tsx';
import { ResumoIA, casaOf, pickResumo, useResumos } from '../components/Resumo.tsx';
import { ementaGist } from '../content/propositionTypes.ts';
import { DecidedByChip, OutcomePill, SUBJECT_SITE, SubjectProgress, TypeBadge, VetoNote } from '../views/FeedView.tsx';

type Status = NonNullable<NonNullable<Event['subject']>['status']>;

/**
 * Situação atual entre as fontes: a mais recente pela data da situação. A Câmara e o Senado gravam cada um a
 * sua; quando a proposta está no Senado, a Câmara já repete a do Senado.
 */
function currentStatus(events: Event[]): Status | undefined {
  let best: Event | undefined;
  const key = (e: Event) => `${e.subject!.status!.since ?? ''}|${e.provenance.fetchedAt}`;
  for (const e of events) {
    if (e.subject?.status && (!best || key(e) > key(best))) best = e;
  }
  return best?.subject?.status;
}

function Timeline({ events }: { events: Event[] }) {
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
    </ol>
  );
}

function Proposta({ refKey, events }: { refKey: string; events: Event[] }) {
  const own = events.filter((e) => e.subject?.kind !== 'VET');
  const vetos = events.filter((e) => e.subject?.kind === 'VET');
  // Ementa e tipo: da própria proposta; se só houver o veto, dele.
  const subject = (own.at(-1) ?? events.at(-1))?.subject;
  const kind = own[0]?.subject?.kind ?? refKey.split('-')[0]!;
  const status = currentStatus(own);
  const procedimentos = events.filter((e) => e.category === 'procedimento');
  const decisivos = events.filter((e) => e.category !== 'procedimento');
  const sites = new Map<string, string>();
  for (const e of events) {
    const s = e.subject;
    if (s?.url && !sites.has(s.url)) {
      sites.set(s.url, s.kind === 'VET' ? `O veto ${s.label} no site do Senado` : (SUBJECT_SITE[s.id.split(':')[0]!] ?? 'Tramitação completa'));
    }
  }
  const gist = subject && subject.kind !== 'VET' ? ementaGist(subject.title) : null;
  // Versão do texto da Casa onde a proposta andou por último.
  const resumo = pickResumo(useResumos([refKey]).get(refKey), own.at(-1) && casaOf(own.at(-1)!.subject!.id));

  return (
    <>
      <div className="vote-meta">
        <TypeBadge kind={kind} />
      </div>
      <h1 className="page-title">{refLabel(refKey)}</h1>
      <div className="proposta-ementa">
        {resumo ? (
          <>
            <p className="vote-title">{resumo.titulo}</p>
            <ResumoIA resumo={resumo} />
          </>
        ) : (
          subject && <p className="explain-simple">{gist ?? subject.title}</p>
        )}
        {(gist || resumo) && subject && (
          <details className="vote-more">
            <summary>Texto oficial (ementa)</summary>
            <p>{subject.title}</p>
          </details>
        )}
      </div>

      {(status || vetos.length > 0) && (
        <Section title="Em que pé está">
          <Card>
            {status && <SubjectProgress status={status} />}
            {vetos.length > 0 && <VetoNote events={vetos} />}
          </Card>
        </Section>
      )}

      <Section
        title="O que aconteceu"
        intro="Votações e decisões registradas pela Câmara, pelo Senado e pelo Congresso, da mais antiga para a mais recente."
      >
        <Card>
          <Timeline events={decisivos} />
          {procedimentos.length > 0 && (
            <details className="vote-more">
              <summary>
                Ver também {procedimentos.length === 1 ? 'o pedido votado' : `os ${procedimentos.length} pedidos votados`} sobre o andamento
                (urgência, adiamento…)
              </summary>
              <Timeline events={procedimentos} />
            </details>
          )}
        </Card>
      </Section>

      {sites.size > 0 && (
        <Section title="Nos sites oficiais">
          <ul className="caveats">
            {[...sites].map(([url, label]) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="muted">
        Aqui aparece o que este site coletou: votações dos últimos 30 dias e vetos deste ano e do anterior. O histórico
        completo está nos sites oficiais.
      </p>
    </>
  );
}

/** Tudo sobre uma proposta, juntando Câmara, Senado e vetos pela chave comum (`subject.ref`). */
export function PropostaPage({ refKey }: { refKey: string }) {
  const state = useAsync(() => api.proposta(refKey), [refKey]);
  return (
    <>
      <a className="back" href={href.topic('politica')}>
        ← Política
      </a>
      <p className="hero-kicker">Proposta</p>
      <Async state={state}>
        {(records) => {
          const events = records.filter((r): r is Event => r.kind === 'event');
          if (!events.length) {
            return (
              <>
                <h1 className="page-title">{refLabel(refKey)}</h1>
                <p className="muted">Ainda não há registro desta proposta nos dados coletados.</p>
              </>
            );
          }
          return <Proposta refKey={refKey} events={events} />;
        }}
      </Async>
    </>
  );
}
