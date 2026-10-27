import { useState, type ReactNode } from 'react';
import type { SbRecord } from '@sb/core';
import { api } from '../lib/api.ts';
import { FREQUENCY_LABEL, THEME_LABEL, formatDate, formatDateTime, formatValue } from '../lib/format.ts';
import { href } from '../lib/router.ts';
import { useAsync } from '../lib/useAsync.ts';
import { Async, Card, Explain, Section } from '../components/ui.tsx';
import { DatasetView } from '../views/registry.tsx';
import { topicOfTheme } from '../config/topics.ts';
import { SummaryText, useSummary } from '../components/summary.tsx';
import { ReadWith } from '../components/ReadWith.tsx';

/** Bloco recolhível: o conteúdo só é montado (e buscado) quando a pessoa abre. */
function Deep({ title, intro, children }: { title: string; intro?: string; children: () => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="deep" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      {intro && <p className="stat-sub">{intro}</p>}
      {open && children()}
    </details>
  );
}

function DatasetSummary({ d }: { d: Parameters<typeof useSummary>[0] }) {
  const s = useSummary(d);
  return s.status === 'ok' && s.data ? <SummaryText summary={s.data} size="lg" /> : null;
}

function recordCells(r: SbRecord, unit: string | undefined, decimals: number): [string, string] {
  switch (r.kind) {
    case 'observation':
      return [`${r.period.label} · ${r.territory.name ?? r.territory.code}`, formatValue(r.value, unit, decimals)];
    case 'event':
      return [formatDateTime(r.occurredAt), r.title];
    case 'entity':
      return [r.territory?.code ?? r.id, r.name];
  }
}

/** Últimos registros com a proveniência completa de cada um. */
function AuditTable({ datasetId, unit, decimals }: { datasetId: string; unit?: string; decimals: number }) {
  const state = useAsync(() => api.records(datasetId, { order: 'desc', limit: 50 }), [datasetId]);
  return (
    <Async state={state}>
      {({ records }) => (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referência</th>
                <th>Valor / conteúdo</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const [ref, val] = recordCells(r, unit, decimals);
                return (
                  <tr key={r.id}>
                    <td>{ref}</td>
                    <td>
                      {val}
                      <details>
                        <summary className="muted">registro completo</summary>
                        <pre className="json">{JSON.stringify(r, null, 2)}</pre>
                      </details>
                    </td>
                    <td>
                      <a href={r.provenance.originUrl} target="_blank" rel="noreferrer">
                        consulta original
                      </a>
                      {r.provenance.rawHash && (
                        <>
                          {' · '}
                          <a href={api.rawUrl(r.provenance.rawHash)} target="_blank" rel="noreferrer">
                            bruto arquivado
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Async>
  );
}

export function DatasetPage({ id }: { id: string }) {
  const state = useAsync(() => api.dataset(id), [id]);
  return (
    <Async state={state}>
      {({ descriptor: d, source, stats }) => (
        <>
          {(() => {
            const topic = topicOfTheme(d.theme);
            return topic ? (
              <a className="back" href={href.topic(topic.id)}>
                ← {topic.title}
              </a>
            ) : (
              <a className="back" href={href.home()}>
                ← Início
              </a>
            );
          })()}
          <p className="hero-kicker">{THEME_LABEL[d.theme] ?? d.theme}</p>
          <h1 className="page-title">{d.title}</h1>
          <DatasetSummary d={d} />
          <ReadWith d={d} />

          <Section title="Os números">
            <Card>
              <DatasetView descriptor={d} mode="full" />
            </Card>
          </Section>

          <Section title="O que é">
            <Card>
              <Explain explanation={d.explanation} open />
            </Card>
          </Section>

          {d.caveats.length > 0 && (
            <Section title="Cuidados ao ler este dado">
              <ul className="caveats">
                {d.caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Section>
          )}

          <Deep title="Ficha técnica" intro="Tudo o que é preciso para conferir este dado por conta própria.">
            {() => (
              <dl className="kv">
                <dt>Fonte</dt>
                <dd>
                  <a href={href.source(source.id)}>{source.name}</a> ({source.publisher})
                </dd>
                <dt>Atualizado pela fonte</dt>
                <dd>{FREQUENCY_LABEL[d.frequency] ?? d.frequency}</dd>
                {d.unit && (
                  <>
                    <dt>Unidade</dt>
                    <dd>{d.unit}</dd>
                  </>
                )}
                <dt>Registros guardados</dt>
                <dd>{stats.count.toLocaleString('pt-BR')}</dd>
                {stats.firstTime && stats.lastTime && (
                  <>
                    <dt>Período coberto</dt>
                    <dd>
                      {formatDate(stats.firstTime.slice(0, 10))} a {formatDate(stats.lastTime.slice(0, 10))}
                    </dd>
                  </>
                )}
                {stats.lastFetchedAt && (
                  <>
                    <dt>Última coleta</dt>
                    <dd>{formatDateTime(stats.lastFetchedAt)}</dd>
                  </>
                )}
                {d.originDocs && (
                  <>
                    <dt>Documentação oficial</dt>
                    <dd>
                      <a href={d.originDocs} target="_blank" rel="noreferrer">
                        {new URL(d.originDocs).host}
                      </a>
                    </dd>
                  </>
                )}
                <dt>Identificador</dt>
                <dd>
                  <code>{d.id}</code>
                </dd>
              </dl>
            )}
          </Deep>

          <Deep
            title="Registros e auditoria"
            intro="Os 50 registros mais recentes. Cada um aponta para a consulta original e para a resposta bruta arquivada no momento da coleta."
          >
            {() => <AuditTable datasetId={d.id} unit={d.unit} decimals={d.decimals} />}
          </Deep>
        </>
      )}
    </Async>
  );
}
