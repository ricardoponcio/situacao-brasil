/**
 * Regras das propostas e votações (Câmara, Senado, vetos): agrupar por proposta, juntar apensados, escolher a
 * situação atual e separar o que é decisivo do que é só pedido sobre o andamento. Sem React: só dados.
 */
import type { Event, PropostaResumo } from '@sb/core';
import { ementaGist } from '../content/propositionTypes.ts';

export type Subject = NonNullable<Event['subject']>;
export type Status = NonNullable<Subject['status']>;

/** Site onde a proposta tem a tramitação completa, pelo prefixo do id do assunto. */
export const SUBJECT_SITE: Record<string, string> = {
  'camara-proposicao': 'Tramitação completa no site da Câmara',
  'senado-processo': 'Tramitação completa no site do Senado',
};

/** Rótulo do link para o site oficial de um assunto. */
export function subjectSiteLabel(s: Subject): string {
  if (s.kind === 'VET') return `O veto ${s.label} no site do Senado`;
  return SUBJECT_SITE[s.id.split(':')[0]!] ?? 'Tramitação completa';
}

export const isVeto = (s: Subject | undefined) => s?.kind === 'VET';
export const isProcedimento = (e: Event) => e.category === 'procedimento';

/** A situação mais recente entre as votações do grupo (cada coleta grava a situação do momento). */
export function latestStatus(events: Event[]): Status | undefined {
  let best: Event | undefined;
  for (const e of events) {
    if (e.subject?.status && (!best || e.provenance.fetchedAt > best.provenance.fetchedAt)) best = e;
  }
  return best?.subject?.status;
}

/**
 * Situação atual entre as fontes: a mais recente pela data da situação. A Câmara e o Senado gravam cada um a
 * sua; quando a proposta está no Senado, a Câmara já repete a do Senado.
 */
export function currentStatus(events: Event[]): Status | undefined {
  let best: Event | undefined;
  const key = (e: Event) => `${e.subject!.status!.since ?? ''}|${e.provenance.fetchedAt}`;
  for (const e of events) {
    if (e.subject?.status && (!best || key(e) > key(best))) best = e;
  }
  return best?.subject?.status;
}

// ---------- Resumos feitos por IA ----------

/** Casa do assunto, pelo prefixo do id ("camara-proposicao:123"). */
export function casaOf(subjectId: string): string | undefined {
  const prefix = subjectId.split(':')[0];
  return prefix === 'camara-proposicao' ? 'camara' : prefix === 'senado-processo' ? 'senado' : undefined;
}

/** A versão do texto da Casa pedida (o texto muda de uma Casa para a outra); se não houver, a mais recente. */
export function pickResumo(list: PropostaResumo[] | undefined, casa?: string): PropostaResumo | undefined {
  return list?.find((r) => r.casa === casa) ?? list?.[0];
}

/** Resumos agrupados pela chave da proposta. */
export function resumosPorRef(list: PropostaResumo[]): Map<string, PropostaResumo[]> {
  const map = new Map<string, PropostaResumo[]>();
  for (const r of list) map.set(r.ref, [...(map.get(r.ref) ?? []), r]);
  return map;
}

// ---------- Vetos ----------

/** Eventos de veto agrupados pelo projeto vetado (`subject.ref`). */
export function vetosPorRef(records: { kind: string }[]): Map<string, Event[]> {
  const map = new Map<string, Event[]>();
  for (const r of records as Event[]) {
    if (r.kind !== 'event' || !r.subject?.ref) continue;
    map.set(r.subject.ref, [...(map.get(r.subject.ref) ?? []), r]);
  }
  return map;
}

export interface VetoLinha {
  key: string;
  /** "O Presidente vetou o projeto inteiro" ou "...parte do projeto". */
  what: string;
  label: string;
  /** Data em que o veto foi aposto (AAAA-MM-DD), se registrada. */
  date?: string;
  status?: Status;
}

/** Uma linha por veto do projeto: o que foi vetado, quando e em que pé está. */
export function vetoLinhas(events: Event[]): VetoLinha[] {
  const byVeto = new Map<string, Event[]>();
  for (const e of events) byVeto.set(e.subject!.id, [...(byVeto.get(e.subject!.id) ?? []), e]);
  return [...byVeto.values()].map((evs) => {
    const aposto = evs.find((e) => e.category === 'veto');
    return {
      key: evs[0]!.subject!.id,
      what: aposto?.outcome === 'veto-total' ? 'O Presidente vetou o projeto inteiro' : 'O Presidente vetou parte do projeto',
      label: evs[0]!.subject!.label,
      date: aposto?.occurredAt.slice(0, 10),
      status: latestStatus(evs),
    };
  });
}

// ---------- Lista agrupada por proposta ----------

export interface Group {
  subject: Subject;
  events: Event[]; // mais recente primeiro
  /** Projetos apensados a este (anexados, andam junto), quando o agrupamento está ligado. */
  apensados?: Group[];
  /** Apensados que a Câmara não detalha (a votação não diz qual é o projeto, só o número interno). */
  apensadosSemDetalhe?: number;
}

export interface Grouped {
  groups: Group[];
  /** Eventos sem assunto (ex.: votação cujo detalhe a Câmara não devolveu). */
  loose: Event[];
}

/** Agrupa os eventos por assunto, do mais recente para o mais antigo. */
export function groupBySubject(events: Event[]): Grouped {
  const groups = new Map<string, Group>();
  const loose: Event[] = [];
  for (const e of [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
    if (!e.subject) {
      loose.push(e);
      continue;
    }
    const g = groups.get(e.subject.id) ?? { subject: e.subject, events: [] };
    g.events.push(e);
    groups.set(e.subject.id, g);
  }
  return { groups: [...groups.values()], loose };
}

/** Chave da proposta principal, se a votação é de um projeto apensado (gravada pela coleta da Câmara). */
const principalOf = (e: Event) => (typeof e.attributes.principalRef === 'string' ? e.attributes.principalRef : undefined);

/** Junta os apensados na proposta principal. Só junta quando a principal também está na lista. */
export function agruparApensados({ groups, loose }: Grouped): Grouped {
  const byRef = new Map<string, Group>();
  for (const g of groups) if (g.subject.ref) byRef.set(g.subject.ref, { ...g, apensados: [], apensadosSemDetalhe: 0 });
  const principalDe = (evs: Event[]) => {
    for (const e of evs) {
      const ref = principalOf(e);
      if (ref && byRef.has(ref)) return byRef.get(ref)!;
    }
    return undefined;
  };
  const out: Group[] = [];
  for (const g of groups) {
    const p = principalDe(g.events);
    if (p && p.subject.ref !== g.subject.ref) p.apensados!.push(g);
    else out.push(g.subject.ref ? byRef.get(g.subject.ref)! : g);
  }
  // Votações sem proposta ligada: o começo do id da votação é o id do projeto na Câmara.
  const semDetalhe = new Map<Group, Set<string>>();
  const rest: Event[] = [];
  for (const e of loose) {
    const p = principalDe([e]);
    if (!p) {
      rest.push(e);
      continue;
    }
    const ids = semDetalhe.get(p) ?? new Set<string>();
    ids.add(`camara-proposicao:${String(e.attributes.idVotacao ?? e.id).split('-')[0]}`);
    semDetalhe.set(p, ids);
  }
  // Um apensado pode ter uma votação detalhada e outra não: conta uma vez só.
  for (const [p, ids] of semDetalhe) {
    for (const a of p.apensados!) ids.delete(a.subject.id);
    ids.delete(p.subject.id);
    p.apensadosSemDetalhe = ids.size;
  }
  return { groups: out, loose: rest };
}

export const totalApensados = (g: Group) => (g.apensados?.length ?? 0) + (g.apensadosSemDetalhe ?? 0);

/** Lista pronta para a tela, com ou sem os apensados juntos, e quanto o agrupamento junta. */
export function feedPorProposta(events: Event[], agrupar: boolean) {
  const separado = groupBySubject(events);
  const junto = agruparApensados(separado);
  const comApensados = junto.groups.filter((g) => totalApensados(g) > 0);
  return {
    ...(agrupar ? junto : separado),
    /**
     * Propostas que podem ter resumo ou veto, da lista solta: não muda ao ligar ou desligar o agrupamento,
     * então trocar a opção não dispara busca nova (a tela piscava sem os resumos enquanto carregava).
     */
    refs: refsComResumo(separado.groups),
    /** Há algo para agrupar? (senão, a opção nem aparece) */
    temApensados: junto.groups.length < separado.groups.length || junto.loose.length < separado.loose.length,
    juntados: comApensados.reduce((n, g) => n + totalApensados(g), 0),
    propostasComApensados: comApensados.length,
  };
}

/** Chaves das propostas da lista que podem ter resumo ou veto (vetos não têm resumo próprio). */
export const refsComResumo = (groups: Group[]) => groups.flatMap((g) => (g.subject.ref && !isVeto(g.subject) ? [g.subject.ref] : []));

// ---------- Página da proposta ----------

export interface PropostaDados {
  subject?: Subject;
  kind: string;
  status?: Status;
  vetos: Event[];
  decisivos: Event[];
  procedimentos: Event[];
  /** Links para os sites oficiais (url → rótulo), sem repetir. */
  sites: [string, string][];
  /** Ementa encurtada, quando dá para encurtar. */
  gist: string | null;
  /** Casa onde a proposta andou por último (para escolher a versão do resumo). */
  casa?: string;
}

/** Tudo o que a página da proposta mostra, a partir dos eventos de Câmara, Senado e vetos. */
export function propostaDados(refKey: string, events: Event[]): PropostaDados {
  const own = events.filter((e) => !isVeto(e.subject));
  const vetos = events.filter((e) => isVeto(e.subject));
  // Ementa e tipo: da própria proposta; se só houver o veto, dele.
  const subject = (own.at(-1) ?? events.at(-1))?.subject;
  const sites = new Map<string, string>();
  for (const e of events) {
    const s = e.subject;
    if (s?.url && !sites.has(s.url)) sites.set(s.url, subjectSiteLabel(s));
  }
  return {
    subject,
    kind: own[0]?.subject?.kind ?? refKey.split('-')[0]!,
    status: currentStatus(own),
    vetos,
    decisivos: events.filter((e) => !isProcedimento(e)),
    procedimentos: events.filter(isProcedimento),
    sites: [...sites],
    gist: subject && !isVeto(subject) ? ementaGist(subject.title) : null,
    casa: own.at(-1) && casaOf(own.at(-1)!.subject!.id),
  };
}
