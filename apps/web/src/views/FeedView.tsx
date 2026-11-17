import type { Event } from '@sb/core';
import { EventList } from '../components/propostas/Eventos.tsx';
import { PropostasFeed } from '../components/propostas/PropostasFeed.tsx';
import type { ViewDefinition, ViewProps } from './types.ts';

/** Lista de eventos. Com `groupBySubject`, agrupa por proposta (votações da Câmara, do Senado, vetos). */
function Feed({ records, descriptor }: ViewProps) {
  const events = records.filter((r): r is Event => r.kind === 'event');
  return descriptor.view.options.groupBySubject ? <PropostasFeed events={events} /> : <EventList events={events} />;
}

export const feedView: ViewDefinition = {
  query: (_d, mode) => ({ order: 'desc', limit: mode === 'card' ? 6 : 300 }),
  component: Feed,
};
