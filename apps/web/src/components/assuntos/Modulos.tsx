/** Blocos explicativos do assunto que não vêm de dataset (ex.: como uma lei é feita). */
import { useEffect, useRef, type ReactNode } from 'react';
import type { TopicModule } from '../../config/topics.ts';
import { PROCESSES } from '../../content/legislativeProcesses.ts';
import { OPEN_PROCESS_EVENT, pendingProcessRequest } from '../../content/propositionTypes.ts';
import { ProcessFlow } from '../ProcessFlow.tsx';

const MODULES: Record<TopicModule, { title: string; intro: string; render: () => ReactNode; openOn?: string }> = {
  'processo-legislativo': {
    title: 'Como uma lei é feita? Entenda o caminho de projetos de lei, PECs, medidas provisórias e vetos',
    intro: 'Cada cor mostra quem decide naquela etapa.',
    openOn: OPEN_PROCESS_EVENT,
    render: () => <ProcessFlow processes={PROCESSES} />,
  },
};

/** Bloco explicativo recolhido: não pesa na primeira leitura. Abre sozinho quando pedido (ex.: selo "PEC ?"). */
export function ModuleAccordion({ m }: { m: TopicModule }) {
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
