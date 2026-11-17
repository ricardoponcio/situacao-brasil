import { refLabel, type Event } from '@sb/core';
import { href } from '../lib/router.ts';
import { Async, BackLink, Card, ExternalLinks, Section } from '../components/ui.tsx';
import { pickResumo, propostaDados } from '../controllers/propostas.ts';
import { useProposta, useResumos } from '../hooks/usePropostas.ts';
import { LastRecord, SubjectProgress, VetoNote } from '../components/propostas/Andamento.tsx';
import { Timeline } from '../components/propostas/Eventos.tsx';
import { EmentaOficial, ResumoIA } from '../components/propostas/Resumo.tsx';
import { TypeBadge } from '../components/propostas/Selos.tsx';

function Proposta({ refKey, events }: { refKey: string; events: Event[] }) {
  const p = propostaDados(refKey, events);
  // Versão do texto da Casa onde a proposta andou por último.
  const resumo = pickResumo(useResumos([refKey]).get(refKey), p.casa);
  const { subject, status, vetos, decisivos, procedimentos, sites } = p;

  return (
    <>
      <div className="vote-meta">
        <TypeBadge kind={p.kind} />
      </div>
      <h1 className="page-title">{refLabel(refKey)}</h1>
      <div className="proposta-ementa">
        {resumo ? (
          <>
            <p className="vote-title">{resumo.titulo}</p>
            <ResumoIA resumo={resumo} />
          </>
        ) : (
          subject && <p className="explain-simple">{p.gist ?? subject.title}</p>
        )}
        {subject && <EmentaOficial ementa={subject.title} show={!!(p.gist || resumo)} />}
      </div>

      {(status || vetos.length > 0 || decisivos.length > 0 || sites.length > 0) && (
        <Section title="Em que pé está">
          <Card>
            {status && <SubjectProgress status={status} />}
            {vetos.length > 0 && <VetoNote events={vetos} />}
            {decisivos.length > 0 && <LastRecord event={decisivos.at(-1)!} />}
            <ExternalLinks links={sites.map(([url, label]) => ({ url, label }))} className="vote-links" linkClassName="vote-link" />
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

      <p className="muted">
        Aqui aparece o que este site coletou: votações dos últimos 30 dias e vetos deste ano e do anterior. O histórico
        completo está nos sites oficiais.
      </p>
    </>
  );
}

/** Tudo sobre uma proposta, juntando Câmara, Senado e vetos pela chave comum (`subject.ref`). */
export function PropostaPage({ refKey }: { refKey: string }) {
  const state = useProposta(refKey);
  return (
    <>
      <BackLink href={href.topic('politica')}>Política</BackLink>
      <p className="hero-kicker">Proposta</p>
      <Async state={state}>
        {(events) =>
          events.length ? (
            <Proposta refKey={refKey} events={events} />
          ) : (
            <>
              <h1 className="page-title">{refLabel(refKey)}</h1>
              <p className="muted">Ainda não há registro desta proposta nos dados coletados.</p>
            </>
          )
        }
      </Async>
    </>
  );
}
