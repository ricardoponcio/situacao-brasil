import type { DatasetDescriptor } from '@sb/core';
import type { TopicLayout } from '../../controllers/assuntos.ts';
import { href } from '../../lib/router.ts';
import { DatasetView } from '../../views/registry.tsx';
import { DatasetSummary } from '../summary.tsx';
import { ReadWith } from '../ReadWith.tsx';
import { Explain, Segmented } from '../ui.tsx';

/** Nível 3: um indicador dentro do assunto. Frase → gráfico → explicação → link para auditar. */
export function Indicator({ d }: { d: DatasetDescriptor }) {
  return (
    <section className="indicator" id={`ind-${d.id}`}>
      <h2>{d.title}</h2>
      <DatasetSummary d={d} />
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

/** Os indicadores do assunto, organizados como o controller decidiu (abas, grupos ou lista). */
export function TopicIndicators({ layout, onChoose }: { layout: TopicLayout; onChoose: (datasetId: string) => void }) {
  switch (layout.kind) {
    case 'vazio':
      return <p className="muted">Ainda não há dados sobre este assunto. Em construção.</p>;
    case 'abas':
      return (
        <>
          <Segmented
            className="topic-tabs"
            label="O que mostrar"
            options={layout.tabs.map((t) => ({ id: t.d.id, label: t.label }))}
            value={layout.current.id}
            onChange={onChoose}
          />
          <Indicator key={layout.current.id} d={layout.current} />
        </>
      );
    case 'grupos':
      return (
        <>
          {layout.sections.map((g) => (
            <section key={g.title} className="topic-group">
              {layout.titled && <h2 className="topic-group-title">{g.title}</h2>}
              {g.list.map((d) => (
                <Indicator key={d.id} d={d} />
              ))}
            </section>
          ))}
        </>
      );
    case 'lista':
      return (
        <>
          {layout.list.map((d) => (
            <Indicator key={d.id} d={d} />
          ))}
        </>
      );
  }
}
