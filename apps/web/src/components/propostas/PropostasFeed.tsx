import { useState } from 'react';
import type { Event } from '@sb/core';
import { feedPorProposta } from '../../controllers/propostas.ts';
import { useResumos, useVetosByRef } from '../../hooks/usePropostas.ts';
import { ApensadosToggle } from './Apensados.tsx';
import { EventList } from './Eventos.tsx';
import { PropostaCard } from './PropostaCard.tsx';

/** Quantas propostas aparecem de início; o resto fica atrás de "Mostrar mais" (listas longas cansam, no celular mais ainda). */
const PAGE = 8;

/** Lista agrupada por proposta; eventos sem proposta ficam numa lista à parte. */
export function PropostasFeed({ events }: { events: Event[] }) {
  const [shown, setShown] = useState(PAGE);
  const [agrupar, setAgrupar] = useState(true);
  const feed = feedPorProposta(events, agrupar);
  const { groups, loose, refs } = feed;
  const vetos = useVetosByRef(refs.length > 0);
  const resumos = useResumos(refs);
  if (!groups.length) return <EventList events={loose} />;
  return (
    <>
      {feed.temApensados && (
        <ApensadosToggle checked={agrupar} onChange={setAgrupar} juntados={feed.juntados} propostas={feed.propostasComApensados} />
      )}
      <ul className="vote-groups">
        {groups.slice(0, shown).map((g) => (
          <PropostaCard
            key={g.subject.id}
            g={g}
            vetos={g.subject.ref ? vetos.get(g.subject.ref) : undefined}
            resumos={g.subject.ref ? resumos.get(g.subject.ref) : undefined}
          />
        ))}
      </ul>
      {groups.length > shown && (
        <button className="show-more" onClick={() => setShown((n) => n + PAGE * 2)}>
          Mostrar mais {Math.min(PAGE * 2, groups.length - shown)} (de {groups.length - shown} restantes)
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
