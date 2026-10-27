import type { DatasetDescriptor, DatasetStats } from '@sb/core';
import { api } from '../lib/api.ts';
import { formatDate } from '../lib/format.ts';
import { href } from '../lib/router.ts';
import { useAsync } from '../lib/useAsync.ts';
import { TOPICS, type Topic } from '../config/topics.ts';
import { Sparkline } from '../components/charts/Sparkline.tsx';
import { useSummary } from '../components/summary.tsx';
import { useCompanions } from '../components/ReadWith.tsx';

type Item = { descriptor: DatasetDescriptor; stats: DatasetStats };

/** O dataset que representa o assunto: o marcado como destaque, senão o primeiro. */
function leadOf(topic: Topic, items: Item[]): DatasetDescriptor | undefined {
  const mine = items.map((i) => i.descriptor).filter((d) => topic.themes.includes(d.theme));
  return mine.find((d) => d.featured) ?? mine[0];
}

/** Nível 1: uma frase por assunto. */
function BriefLine({ topic, lead }: { topic: Topic; lead: DatasetDescriptor }) {
  const s = useSummary(lead);
  // O primeiro "leia junto" entra na mesma frase: o número nunca aparece sozinho.
  const pair = useSummary(useCompanions(lead)[0]);
  if (s.status !== 'ok' || !s.data) return null;
  const [main, firstContext] = s.data.sentences;
  const pairMain = pair.status === 'ok' ? pair.data?.sentences[0] : undefined;
  return (
    <li>
      <span className="brief-topic">{topic.title}.</span> {main} {firstContext} {pairMain}{' '}
      <a href={href.topic(topic.id)} className="brief-more">
        Saber mais
      </a>
    </li>
  );
}

function CompanionFigure({ d }: { d: DatasetDescriptor }) {
  const s = useSummary(d);
  if (s.status !== 'ok' || !s.data?.value) return null;
  return (
    <span className="tile-pair">
      {d.title}: <strong>{s.data.value}</strong>
    </span>
  );
}

/** Nível 2: cartão do assunto, com o número e a tendência. Tudo clicável. */
function TopicTile({ topic, lead }: { topic: Topic; lead: DatasetDescriptor }) {
  const s = useSummary(lead);
  const summary = s.status === 'ok' ? s.data : null;
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

export function HomePage() {
  const datasets = useAsync(() => api.datasets(), []);
  const items = datasets.status === 'ok' ? datasets.data : [];
  const active = TOPICS.flatMap((t) => {
    const lead = leadOf(t, items);
    return lead ? [{ topic: t, lead }] : [];
  });
  const upcoming = TOPICS.filter((t) => !active.some((a) => a.topic.id === t.id));

  return (
    <>
      <section className="hero">
        <p className="hero-kicker">{formatDate(new Date().toISOString().slice(0, 10))}</p>
        <h1 className="hero-title">O Brasil hoje, em poucas frases</h1>
        {datasets.status === 'error' && <p className="status-error">Não foi possível carregar os dados.</p>}
        <ul className="brief">
          {active.map(({ topic, lead }) => (
            <BriefLine key={topic.id} topic={topic} lead={lead} />
          ))}
        </ul>
        <p className="hero-note">
          Tudo aqui vem de órgãos oficiais, como o IBGE e a Câmara dos Deputados. Cada número pode ser conferido até a
          origem.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Escolha um assunto</h2>
          <p>Comece pelo que mais importa para você. Dentro de cada assunto, dá para ir aprofundando.</p>
        </div>
        <div className="tiles">
          {active.map(({ topic, lead }) => (
            <TopicTile key={topic.id} topic={topic} lead={lead} />
          ))}
        </div>
        {upcoming.length > 0 && (
          <p className="upcoming">
            <span className="muted">Em breve:</span> {upcoming.map((t) => t.title).join(' · ')}
          </p>
        )}
      </section>

      <details className="about">
        <summary>Como este site organiza o retrato do país</summary>
        <p>
          Vamos agrupar os indicadores em três camadas, do mais básico ao mais avançado, seguindo a ideia do Índice de
          Progresso Social: <strong>necessidades básicas</strong> (comida, água, moradia, segurança),{' '}
          <strong>base para uma vida boa</strong> (saúde, escola, informação, meio ambiente) e{' '}
          <strong>oportunidades</strong> (direitos, inclusão, chance de crescer). Por enquanto, as camadas ainda estão
          sendo montadas.
        </p>
        <p>
          Não damos uma "nota única" para o Brasil: qualquer nota depende de escolher o que pesa mais, e isso é opinião.
          Preferimos mostrar os dados e explicar como ler cada um. <a href={href.sources()}>Veja as fontes</a>.
        </p>
      </details>
    </>
  );
}
