import { useEffect, useState } from 'react';
import { href } from '../lib/router.ts';
import { TOPICS } from '../config/topics.ts';
import { topicLayout } from '../controllers/assuntos.ts';
import { useDatasets } from '../hooks/useDatasets.ts';
import { Async, BackLink } from '../components/ui.tsx';
import { ModuleAccordion } from '../components/assuntos/Modulos.tsx';
import { TopicIndicators } from '../components/assuntos/Indicador.tsx';

export function TopicPage({ id, tab }: { id: string; tab?: string }) {
  const topic = TOPICS.find((t) => t.id === id);
  const state = useDatasets();
  const [chosen, setChosen] = useState(tab);
  useEffect(() => setChosen(tab), [id, tab]);
  if (!topic) return <p>Assunto não encontrado. <a href={href.home()}>Voltar ao início</a></p>;

  const choose = (datasetId: string) => {
    setChosen(datasetId);
    // Guarda a escolha no endereço (dá para compartilhar) sem disparar a troca de página, que rola para o topo.
    history.replaceState(null, '', href.topic(topic.id, datasetId));
  };

  return (
    <>
      <BackLink href={href.home()}>Início</BackLink>
      <p className="hero-kicker">{topic.title}</p>
      <h1 className="page-title">{topic.question}</h1>
      {topic.intro && <p className="lede">{topic.intro}</p>}
      {topic.modules?.map((m) => <ModuleAccordion key={m} m={m} />)}
      <Async state={state}>
        {(items) => (
          <TopicIndicators
            layout={topicLayout(
              topic,
              items.map((i) => i.descriptor),
              chosen,
            )}
            onChoose={choose}
          />
        )}
      </Async>
    </>
  );
}
