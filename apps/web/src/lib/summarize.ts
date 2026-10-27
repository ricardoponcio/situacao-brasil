/**
 * Transforma descriptor + registros em frases simples. Nada aqui conhece um dataset
 * específico: o texto vem de `descriptor.summary` (template, faixas, palavras de direção).
 */
import type { DatasetDescriptor, Event, Observation, SbRecord } from '@sb/core';
import type { RecordsParams } from './api.ts';
import { formatNumber, formatValue } from './format.ts';

const DAY = 86_400_000;

export interface Summary {
  /** Frase principal + frases de contexto, em ordem de leitura. */
  sentences: string[];
  /** Valor em destaque (já formatado), quando faz sentido. */
  value?: string;
  /** Período do valor em destaque, ou descrição da janela. */
  caption?: string;
  /** Valores para mini-tendência (ordem cronológica). */
  trend?: number[];
}

/** Que registros pedir para conseguir resumir este dataset. */
export function summaryQuery(d: DatasetDescriptor): RecordsParams {
  if (d.kind === 'event') {
    const days = d.summary?.windowDays ?? 30;
    return { from: new Date(Date.now() - days * DAY).toISOString().slice(0, 10), order: 'desc', limit: 2000 };
  }
  // Observações: Brasil, histórico mais recente. Mesmos parâmetros da série temporal (cache compartilhado).
  return { level: 'pais', territory: '1', order: 'desc', limit: 120 };
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

function summarizeObservations(d: DatasetDescriptor, records: SbRecord[]): Summary {
  const rows = records
    .filter((r): r is Observation => r.kind === 'observation' && r.value !== null)
    .sort((a, b) => a.period.start.localeCompare(b.period.start));
  const last = rows[rows.length - 1];
  if (!last || last.value === null) return { sentences: ['Ainda não há dados coletados.'] };

  const v = last.value;
  const flat = Math.abs(v) < 10 ** -d.decimals / 2;
  const words = d.summary?.signWords;
  const vars = {
    value: formatValue(v, d.unit, d.decimals),
    round: formatNumber(Math.round(v), 0),
    abs: formatValue(Math.abs(v), d.unit, d.decimals),
    sign: words ? (flat ? words.flat : v > 0 ? words.up : words.down) : '',
    period: last.period.label,
  };

  const sentences: string[] = [];
  if (d.summary) {
    sentences.push(fill(d.summary.template, vars));
    const band = d.summary.bands.find((b) => (b.min === undefined || v >= b.min) && (b.max === undefined || v <= b.max));
    if (band) sentences.push(band.text);
  }

  // Comparação factual com o histórico carregado
  if ((d.summary?.compareHistory ?? true) && rows.length >= 24) {
    const previous = rows.slice(0, -1).map((r) => r.value as number);
    const years = Math.floor((Date.parse(last.period.start) - Date.parse(rows[0]!.period.start)) / (365.25 * DAY));
    if (years >= 2) {
      const lo = Math.min(...previous);
      const hi = Math.max(...previous);
      if (v < lo) sentences.push(`É o menor valor em pelo menos ${years} anos.`);
      else if (v === lo) sentences.push(`Empata com o menor valor em pelo menos ${years} anos.`);
      else if (v > hi) sentences.push(`É o maior valor em pelo menos ${years} anos.`);
      else if (v === hi) sentences.push(`Empata com o maior valor em pelo menos ${years} anos.`);
    }
  }

  return {
    sentences,
    value: vars.value,
    caption: `${last.territory.name ?? 'Brasil'} · ${last.period.label}`,
    trend: rows.slice(-36).map((r) => r.value as number),
  };
}

function summarizeEvents(d: DatasetDescriptor, records: SbRecord[]): Summary {
  const days = d.summary?.windowDays ?? 30;
  const since = Date.now() - days * DAY;
  const recent = records.filter((r): r is Event => r.kind === 'event' && Date.parse(r.occurredAt) >= since);
  const subjects = new Set(recent.flatMap((e) => (e.subject ? [e.subject.id] : []))).size;
  const sentences = d.summary
    ? [fill(d.summary.template, { count: String(recent.length), subjects: String(subjects), days: String(days) })]
    : [];
  // Com assuntos, o número em destaque é de propostas (o que importa), não de votações.
  return subjects
    ? { sentences, value: subjects.toLocaleString('pt-BR'), caption: `propostas votadas nos últimos ${days} dias` }
    : { sentences, value: recent.length.toLocaleString('pt-BR'), caption: `votações nos últimos ${days} dias` };
}

export function summarize(d: DatasetDescriptor, records: SbRecord[]): Summary {
  switch (d.kind) {
    case 'observation':
      return summarizeObservations(d, records);
    case 'event':
      return summarizeEvents(d, records);
    case 'entity':
      return { sentences: [], value: records.length.toLocaleString('pt-BR') };
  }
}
