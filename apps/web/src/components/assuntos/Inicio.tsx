/** Peças da página inicial: uma frase por assunto e o cartão de cada assunto. */
import type { DatasetDescriptor } from '@sb/core';
import type { Topic } from '../../config/topics.ts';
import { href } from '../../lib/router.ts';
import { useCompanions } from '../../hooks/useDatasets.ts';
import { useSummaryData } from '../../hooks/useSummary.ts';
import { Sparkline } from '../charts/Sparkline.tsx';

/** Nível 1: uma frase por assunto. O primeiro "leia junto" entra na mesma frase: o número nunca aparece sozinho. */
export function BriefLine({ topic, lead }: { topic: Topic; lead: DatasetDescriptor }) {
  const s = useSummaryData(lead);
  const pair = useSummaryData(useCompanions(lead)[0]);
  if (!s) return null;
  const [main, firstContext] = s.sentences;
  return (
    <li>
      <span className="brief-topic">{topic.title}.</span> {main} {firstContext} {pair?.sentences[0]}{' '}
      <a href={href.topic(topic.id)} className="brief-more">
        Saber mais
      </a>
    </li>
  );
}

/** "Subutilização: 13,0%", embaixo do número principal do cartão. */
function CompanionFigure({ d }: { d: DatasetDescriptor }) {
  const s = useSummaryData(d);
  if (!s?.value) return null;
  return (
    <span className="tile-pair">
      {d.title}: <strong>{s.value}</strong>
    </span>
  );
}

/** Nível 2: cartão do assunto, com o número e a tendência. Tudo clicável. */
export function TopicTile({ topic, lead }: { topic: Topic; lead: DatasetDescriptor }) {
  const summary = useSummaryData(lead);
  const companions = useCompanions(lead);
  return (
    <a className="tile" href={href.topic(topic.id)}>
      <span className="tile-kicker">{topic.title}</span>
      <span className="tile-question">{topic.question}</span>
      {summary ? (
        <>
          <span className="tile-figure">
            <span className="tile-value">{summary.value}</span>
            {summary.trend && <Sparkline values={summary.trend} label={`Tendência de ${lead.title}`} />}
          </span>
          <span className="tile-caption">{summary.caption}</span>
          {companions.map((c) => (
            <CompanionFigure key={c.id} d={c} />
          ))}
        </>
      ) : (
        <span className="muted">Carregando…</span>
      )}
      <span className="tile-cta">Ver o assunto →</span>
    </a>
  );
}
