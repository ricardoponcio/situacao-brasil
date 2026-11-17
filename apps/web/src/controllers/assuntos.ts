/**
 * Regras dos assuntos (página inicial e página do assunto): qual indicador representa cada assunto, em que
 * ordem os indicadores aparecem e para onde volta o link "←". Sem React: só dados.
 */
import type { DatasetDescriptor } from '@sb/core';
import { TOPICS, topicOfTheme, type Topic } from '../config/topics.ts';
import { href } from '../lib/router.ts';

/** Os datasets do assunto, pelo tema. */
export const datasetsOfTopic = (topic: Topic, all: DatasetDescriptor[]) => all.filter((d) => topic.themes.includes(d.theme));

/** O dataset que representa o assunto: o marcado como destaque, senão o primeiro. */
export function leadOf(topic: Topic, all: DatasetDescriptor[]): DatasetDescriptor | undefined {
  const mine = datasetsOfTopic(topic, all);
  return mine.find((d) => d.featured) ?? mine[0];
}

/** Assuntos com dados (e o indicador de cada um) e os que ainda vêm ("em breve"). */
export function homeTopics(all: DatasetDescriptor[]) {
  const active = TOPICS.flatMap((topic) => {
    const lead = leadOf(topic, all);
    return lead ? [{ topic, lead }] : [];
  });
  const upcoming = TOPICS.filter((t) => !active.some((a) => a.topic.id === t.id));
  return { active, upcoming };
}

export type TopicLayout =
  | { kind: 'vazio' }
  /** Um indicador por vez, escolhido por botões. */
  | { kind: 'abas'; tabs: { d: DatasetDescriptor; label: string }[]; current: DatasetDescriptor }
  /** Grupos com subtítulo (o subtítulo some quando há um grupo só). */
  | { kind: 'grupos'; sections: { title: string; list: DatasetDescriptor[] }[]; titled: boolean }
  | { kind: 'lista'; list: DatasetDescriptor[] };

/** Como os indicadores do assunto se organizam na página. `chosen` é a aba pedida no endereço. */
export function topicLayout(topic: Topic, all: DatasetDescriptor[], chosen?: string): TopicLayout {
  const mine = datasetsOfTopic(topic, all);
  if (!mine.length) return { kind: 'vazio' };

  if (topic.tabs) {
    const order = Object.keys(topic.tabs);
    const pos = (d: DatasetDescriptor) => (order.includes(d.id) ? order.indexOf(d.id) : order.length);
    const list = [...mine].sort((a, b) => pos(a) - pos(b));
    return {
      kind: 'abas',
      tabs: list.map((d) => ({ d, label: topic.tabs![d.id] ?? d.title })),
      current: list.find((d) => d.id === chosen) ?? list[0]!,
    };
  }

  if (topic.groups) {
    const byId = new Map(mine.map((d) => [d.id, d]));
    const sections = topic.groups.map((g) => ({
      title: g.title,
      list: g.datasets.map((id) => byId.get(id)).filter((d): d is DatasetDescriptor => !!d),
    }));
    const grouped = new Set(topic.groups.flatMap((g) => g.datasets));
    const rest = mine.filter((d) => !grouped.has(d.id));
    if (rest.length) sections.push({ title: 'Outros dados', list: rest });
    const visible = sections.filter((g) => g.list.length);
    // Um grupo só não precisa de subtítulo: seria repetir o assunto.
    return { kind: 'grupos', sections: visible, titled: visible.length > 1 };
  }

  // Destaque primeiro, logo depois os indicadores que devem ser lidos junto com ele.
  const lead = mine.find((d) => d.featured);
  const pairs = lead ? lead.readWith.map((r) => r.datasetId) : [];
  const rank = (d: DatasetDescriptor) => (d === lead ? 0 : pairs.includes(d.id) ? 1 + pairs.indexOf(d.id) : 100);
  return { kind: 'lista', list: [...mine].sort((a, b) => rank(a) - rank(b)) };
}

/** Para onde volta o "←" da página do dado: o assunto (na aba do dado, se houver) ou o início. */
export function backFromDataset(d: DatasetDescriptor): { href: string; label: string } {
  const topic = topicOfTheme(d.theme);
  if (!topic) return { href: href.home(), label: 'Início' };
  return { href: href.topic(topic.id, topic.tabs?.[d.id] ? d.id : undefined), label: topic.title };
}

/** "Leia junto" de um dataset, resolvido para os descriptors completos (os que existem). */
export function companionsOf(d: DatasetDescriptor | undefined, all: DatasetDescriptor[]): DatasetDescriptor[] {
  if (!d) return [];
  return d.readWith.flatMap((r) => all.find((x) => x.id === r.datasetId) ?? []);
}
