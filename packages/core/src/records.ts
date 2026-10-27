/**
 * DTOs genéricas. TODO dado que entra no sistema vira um destes três formatos:
 *
 *  - Observation: um número medido num período e num território (IPCA de set/2026 no Brasil).
 *  - Event:       algo que aconteceu numa data (uma votação, uma lei sancionada, um veto).
 *  - Entity:      algo que existe ao longo do tempo (um município, um deputado, um mandato).
 *
 * Todo registro carrega `provenance`, que permite rastrear de onde ele veio até o
 * payload bruto arquivado (rawHash). É isso que torna o site auditável.
 */
import { z } from 'zod';

export const TerritoryLevel = z.enum(['pais', 'regiao', 'uf', 'municipio']);
export type TerritoryLevel = z.infer<typeof TerritoryLevel>;

/** Códigos IBGE. Brasil = "1"; UF = 2 dígitos; município = 7 dígitos. */
export const Territory = z.object({
  level: TerritoryLevel,
  code: z.string(),
  name: z.string().optional(),
});
export type Territory = z.infer<typeof Territory>;

export const BRASIL: Territory = { level: 'pais', code: '1', name: 'Brasil' };

export const Provenance = z.object({
  sourceId: z.string(),
  datasetId: z.string(),
  /** nome@versão do processador que gerou o registro */
  processor: z.string(),
  /** ISO 8601 */
  fetchedAt: z.string(),
  /** URL exata consultada na origem */
  originUrl: z.string().url(),
  /** sha256 do payload bruto arquivado (ver /api/raw/:hash) */
  rawHash: z.string().optional(),
});
export type Provenance = z.infer<typeof Provenance>;

const RecordBase = z.object({
  /** Estável e determinístico: o mesmo dado de origem sempre gera o mesmo id (permite upsert). */
  id: z.string(),
  datasetId: z.string(),
  provenance: Provenance,
});

export const Observation = RecordBase.extend({
  kind: z.literal('observation'),
  period: z.object({
    /** ISO date (inclusive) */
    start: z.string(),
    /** ISO date (inclusive) */
    end: z.string(),
    /** Rótulo humano: "set/2026", "2º tri 2026" */
    label: z.string(),
  }),
  territory: Territory,
  /** null = a fonte publicou o período mas sem valor (ex.: "..." ou "-" no SIDRA) */
  value: z.number().nullable(),
  /** Recortes adicionais: sexo, faixa etária, grupo do IPCA etc. */
  dimensions: z.record(z.string(), z.string()).default({}),
});
export type Observation = z.infer<typeof Observation>;

export const Actor = z.object({
  name: z.string(),
  /** Papel no evento: autor, relator, presidente-sancionou, votou-sim... */
  role: z.string(),
  entityId: z.string().optional(),
});
export type Actor = z.infer<typeof Actor>;

export const Link = z.object({ label: z.string(), url: z.string().url() });
export type Link = z.infer<typeof Link>;

/**
 * Do que trata o evento. Ex.: a proposição votada. Permite agrupar vários eventos
 * (votações de emendas, requerimentos, texto final) sob o mesmo assunto.
 */
export const EventSubject = z.object({
  id: z.string(),
  /** Classificação curta da origem: PL, PLP, PEC, MPV... */
  kind: z.string(),
  /** Rótulo curto: "PL 1.123/2025" */
  label: z.string(),
  /** Descrição oficial (ex.: ementa) */
  title: z.string(),
  url: z.string().url().optional(),
});
export type EventSubject = z.infer<typeof EventSubject>;

/** Instância que decidiu, no vocabulário do site (mesmas cores do diagrama de tramitação). */
export const DecidedBy = z.enum(['camara', 'senado', 'congresso', 'presidencia']);
export type DecidedBy = z.infer<typeof DecidedBy>;

export const Event = RecordBase.extend({
  kind: z.literal('event'),
  /** ISO datetime */
  occurredAt: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  /** Tipo do evento, livre mas padronizado por dataset: votacao-plenario, lei-sancionada, veto... */
  category: z.string(),
  /** Resultado, quando houver: aprovada, rejeitada, mantido, derrubado... */
  outcome: z.string().optional(),
  subject: EventSubject.optional(),
  decidedBy: DecidedBy.optional(),
  actors: z.array(Actor).default([]),
  links: z.array(Link).default([]),
  territory: Territory.optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});
export type Event = z.infer<typeof Event>;

export const Entity = RecordBase.extend({
  kind: z.literal('entity'),
  /** territorio, pessoa, mandato, orgao, partido... */
  entityType: z.string(),
  name: z.string(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  territory: Territory.optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});
export type Entity = z.infer<typeof Entity>;

export const SbRecord = z.discriminatedUnion('kind', [Observation, Event, Entity]);
export type SbRecord = z.infer<typeof SbRecord>;
export type RecordKind = SbRecord['kind'];

/** Registro como o processador produz: sem proveniência (o framework preenche). */
export type RecordDraft =
  | Omit<z.input<typeof Observation>, 'provenance' | 'datasetId'>
  | Omit<z.input<typeof Event>, 'provenance' | 'datasetId'>
  | Omit<z.input<typeof Entity>, 'provenance' | 'datasetId'>;

/** Chave temporal usada para ordenar/filtrar qualquer registro de forma uniforme. */
export function timeKeyOf(r: SbRecord): string | null {
  switch (r.kind) {
    case 'observation':
      return r.period.start;
    case 'event':
      return r.occurredAt;
    case 'entity':
      return r.validFrom ?? null;
  }
}

export function territoryOf(r: SbRecord): Territory | undefined {
  return r.territory;
}
