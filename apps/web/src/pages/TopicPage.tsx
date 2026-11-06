import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DatasetDescriptor } from '@sb/core';
import { api } from '../lib/api.ts';
import { href } from '../lib/router.ts';
import { useAsync } from '../lib/useAsync.ts';
import { TOPICS, type TopicModule } from '../config/topics.ts';
import { ProcessFlow } from '../components/ProcessFlow.tsx';
import { PROCESSES } from '../content/legislativeProcesses.ts';
import { OPEN_PROCESS_EVENT, pendingProcessRequest } from '../content/propositionTypes.ts';

/** Bloco explicativo recolhido: não pesa na primeira leitura. Abre sozinho quando pedido (ex.: selo "PEC ?"). */
function ModuleAccordion({ m }: { m: TopicModule }) {
  const def = MODULES[m];
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!def.openOn) return;
    const open = () => {
      if (!ref.current) return;
      ref.current.open = true;
      requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    // Veio de outra página pelo selo "PL ?": abre já na chegada.
    if (pendingProcessRequest(true)) open();
    window.addEventListener(def.openOn, open);
    return () => window.removeEventListener(def.openOn!, open);
  }, [def.openOn]);
  return (
    <details className="module-accordion" ref={ref}>
      <summary>{def.title}</summary>
      <p className="summary-context">{def.intro}</p>
      {def.render()}
    </details>
  );
}

const MODULES: Record<TopicModule, { title: string; intro: string; render: () => ReactNode; openOn?: string }> = {
  'processo-legislativo': {
    title: 'Como uma lei é feita? Entenda o caminho de projetos de lei, PECs, medidas provisórias e vetos',
    intro: 'Cada cor mostra quem decide naquela etapa.',
    openOn: OPEN_PROCESS_EVENT,
    render: () => <ProcessFlow processes={PROCESSES} />,
  },
};
import { Async, Explain } from '../components/ui.tsx';
import { SummaryText, useSummary } from '../components/summary.tsx';
import { ReadWith } from '../components/ReadWith.tsx';
import { DatasetView } from '../views/registry.tsx';

/** Nível 3: um indicador dentro do assunto. Frase → gráfico → explicação → link para auditar. */
function Indicator({ d }: { d: DatasetDescriptor }) {
  const s = useSummary(d);
  return (
    <section className="indicator" id={`ind-${d.id}`}>
      <h2>{d.title}</h2>
      {s.status === 'ok' && s.data && <SummaryText summary={s.data} size="lg" />}
      <ReadWith d={d} inPage />
      <div className="indicator-body">
        <DatasetView descriptor={d} mode="full" />
      </div>
      <Explain explanation={d.explanation} />
      <a className="indicator-more" href={href.dataset(d.id)}>
        Detalhes, cuidados ao ler e auditoria →
      </a>
    </section>
  );
}

export function TopicPage({ id, tab }: { id: string; tab?: string }) {
  const topic = TOPICS.find((t) => t.id === id);
  const state = useAsync(() => api.datasets(), []);
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
      <a className="back" href={href.home()}>
        ← Início
      </a>
      <p className="hero-kicker">{topic.title}</p>
      <h1 className="page-title">{topic.question}</h1>
      {topic.intro && <p className="lede">{topic.intro}</p>}
      {topic.modules?.map((m) => <ModuleAccordion key={m} m={m} />)}
      <Async state={state}>
        {(items) => {
          const mine = items.map((i) => i.descriptor).filter((d) => topic.themes.includes(d.theme));
          if (!mine.length) return <p className="muted">Ainda não há dados sobre este assunto. Em construção.</p>;

          if (topic.tabs) {
            const order = Object.keys(topic.tabs);
            const pos = (d: DatasetDescriptor) => (order.includes(d.id) ? order.indexOf(d.id) : order.length);
            const list = [...mine].sort((a, b) => pos(a) - pos(b));
            const current = list.find((d) => d.id === chosen) ?? list[0]!;
            return (
              <>
                <div className="topic-tabs segmented" role="group" aria-label="O que mostrar">
                  {list.map((d) => (
                    <button key={d.id} type="button" aria-pressed={d === current} onClick={() => choose(d.id)}>
                      {topic.tabs![d.id] ?? d.title}
                    </button>
                  ))}
                </div>
                <Indicator key={current.id} d={current} />
              </>
            );
          }

          // Destaque primeiro, logo depois os indicadores que devem ser lidos junto com ele.
          const lead = mine.find((d) => d.featured);
          const pairs = lead ? lead.readWith.map((r) => r.datasetId) : [];
          const rank = (d: DatasetDescriptor) => (d === lead ? 0 : pairs.includes(d.id) ? 1 + pairs.indexOf(d.id) : 100);
          return [...mine].sort((a, b) => rank(a) - rank(b)).map((d) => <Indicator key={d.id} d={d} />);
        }}
      </Async>
    </>
  );
}
