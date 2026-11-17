/**
 * Regras de listas de registros que não são propostas nem séries: fontes e coletas, auditoria e a tabela de
 * entidades (busca e páginas). Sem React: só dados.
 */
import type { Entity, Event, RunSummary, SbRecord, SourceManifest } from '@sb/core';
import { formatDateTime, formatValue } from '../lib/format.ts';

// ---------- Fontes e coletas ----------

export const ACCESS_LABEL: Record<SourceManifest['access']['method'], string> = {
  'api-rest': 'API pública',
  download: 'Arquivos para download',
  scraping: 'Leitura de páginas (raspagem)',
};

export const AUTH_LABEL: Record<SourceManifest['access']['auth'], string> = {
  nenhuma: 'aberta, sem cadastro',
  chave: 'exige chave gratuita',
  token: 'exige login/token',
};

export const RUN_STATUS_LABEL: Record<RunSummary['status'], string> = {
  running: 'em andamento',
  ok: 'ok',
  partial: 'parcial (com avisos)',
  error: 'falhou',
};

/** Classe de cor da situação da coleta (verde ok, vermelho falhou, sem cor no resto). */
export const runStatusClass = (s: RunSummary['status']) => (s === 'ok' ? 'status-ok' : s === 'error' ? 'status-error' : '');

/** Até 3 avisos da coleta numa linha. */
export const runIssuesLine = (r: RunSummary) => (r.issues.length ? r.issues.slice(0, 3).join(' | ') : '–');

// ---------- Auditoria ----------

/** Referência e valor de um registro qualquer, para a tabela de auditoria. */
export function recordCells(r: SbRecord, unit: string | undefined, decimals: number): [string, string] {
  switch (r.kind) {
    case 'observation':
      return [`${r.period.label} · ${r.territory.name ?? r.territory.code}`, formatValue(r.value, unit, decimals)];
    case 'event':
      return [formatDateTime(r.occurredAt), r.title];
    case 'entity':
      return [r.territory?.code ?? r.id, r.name];
  }
}

// ---------- Tabela de entidades ----------

/** Valor de um atributo como texto. */
export const cellText = (v: unknown) => (v === null || v === undefined ? '–' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export const entities = (records: SbRecord[]) => records.filter((r): r is Entity => r.kind === 'entity');

/** Colunas: as pedidas no descriptor; senão, todos os atributos do primeiro registro. */
export const entityColumns = (rows: Entity[], columns?: string[]) => columns ?? Object.keys(rows[0]?.attributes ?? {});

/** Em ordem alfabética, filtradas pelo termo (nome, código ou qualquer coluna). */
export function filterEntities(rows: Entity[], columns: string[], q: string): Entity[] {
  const term = q.trim().toLocaleLowerCase('pt-BR');
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (!term) return sorted;
  return sorted.filter(
    (r) =>
      r.name.toLocaleLowerCase('pt-BR').includes(term) ||
      r.territory?.code.includes(term) ||
      columns.some((c) => cellText(r.attributes[c]).toLocaleLowerCase('pt-BR').includes(term)),
  );
}

/** A página pedida (corrigida para dentro do limite) e o total de páginas. */
export function paginate<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return { pages, current, slice: items.slice(current * size, (current + 1) * size) };
}

// ---------- Calendário de divulgações ----------

/** A próxima divulgação do indicador no calendário (`attributes.chave`), a partir de agora. */
export function nextReleaseOf(records: SbRecord[], key: string, now = new Date().toISOString()) {
  const next = records.find((r): r is Event => r.kind === 'event' && r.attributes.chave === key && r.occurredAt >= now);
  if (!next) return undefined;
  const ref = next.attributes.referencia;
  return { date: next.occurredAt.slice(0, 10), referencia: typeof ref === 'string' ? ref : undefined };
}
