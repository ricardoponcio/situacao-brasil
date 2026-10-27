import type { RunSummary, SourceManifest } from '@sb/core';
import { api } from '../lib/api.ts';
import { FREQUENCY_LABEL, formatDateTime, timeAgo } from '../lib/format.ts';
import { href } from '../lib/router.ts';
import { useAsync } from '../lib/useAsync.ts';
import { Async, Card, Section } from '../components/ui.tsx';

const ACCESS_LABEL = { 'api-rest': 'API pública', download: 'Arquivos para download', scraping: 'Leitura de páginas (raspagem)' };
const AUTH_LABEL = { nenhuma: 'aberta, sem cadastro', chave: 'exige chave gratuita', token: 'exige login/token' };
const STATUS_LABEL: Record<RunSummary['status'], string> = {
  running: 'em andamento',
  ok: 'ok',
  partial: 'parcial (com avisos)',
  error: 'falhou',
};

function RunStatus({ run }: { run: RunSummary | null }) {
  if (!run) return <span className="muted">nunca coletado</span>;
  const cls = run.status === 'ok' ? 'status-ok' : run.status === 'error' ? 'status-error' : '';
  return (
    <span>
      <span className={cls}>{STATUS_LABEL[run.status]}</span> · {timeAgo(run.startedAt)} · {run.recordsCount.toLocaleString('pt-BR')} registros
    </span>
  );
}

function ManifestFacts({ m }: { m: SourceManifest }) {
  return (
    <dl className="kv">
      <dt>Responsável</dt>
      <dd>{m.publisher}</dd>
      <dt>Acesso</dt>
      <dd>
        {ACCESS_LABEL[m.access.method]}, {AUTH_LABEL[m.access.auth]}
      </dd>
      <dt>Publica dados</dt>
      <dd>{FREQUENCY_LABEL[m.publishFrequency]}</dd>
      <dt>Licença</dt>
      <dd>{m.license}</dd>
      <dt>Links</dt>
      <dd>
        <a href={m.homepage} target="_blank" rel="noreferrer">site</a> ·{' '}
        <a href={m.docsUrl} target="_blank" rel="noreferrer">documentação</a>
      </dd>
    </dl>
  );
}

export function SourcesPage() {
  const state = useAsync(() => api.sources(), []);
  return (
    <>
      <h1 className="page-title">Fontes</h1>
      <p className="lede">
        De onde vem cada dado deste site. Só usamos fontes oficiais e públicas, e guardamos uma cópia de cada resposta
        recebida para que qualquer pessoa possa conferir.
      </p>
      <Async state={state}>
        {(sources) => (
          <div className="grid">
            {sources.map(({ manifest: m, datasets, lastRun }) => (
              <Card key={m.id}>
                <h3>
                  <a className="card-title-link" href={href.source(m.id)}>
                    {m.name}
                  </a>
                </h3>
                <ManifestFacts m={m} />
                <div className="stat-sub">
                  Última coleta: <RunStatus run={lastRun} />
                </div>
                <ul className="caveats">
                  {datasets.map((d) => (
                    <li key={d.id}>
                      <a href={href.dataset(d.id)}>{d.title}</a>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}

export function SourcePage({ id }: { id: string }) {
  const state = useAsync(() => api.source(id), [id]);
  return (
    <Async state={state}>
      {({ manifest: m, datasets, runs }) => (
        <>
          <a className="back" href={href.sources()}>
            ← Fontes
          </a>
          <h1 className="page-title">{m.name}</h1>
          <Section title="Sobre a fonte">
            <Card>
              <ManifestFacts m={m} />
              {m.access.notes && <p className="stat-sub">{m.access.notes}</p>}
              <p className="stat-sub">
                Cobertura: {m.coverage.territorial.join(', ')} · {m.coverage.temporal}
              </p>
            </Card>
          </Section>
          {m.limitations.length > 0 && (
            <Section title="Limitações conhecidas">
              <ul className="caveats">
                {m.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Dados que vêm daqui">
            <ul className="caveats">
              {datasets.map((d) => (
                <li key={d.id}>
                  <a href={href.dataset(d.id)}>{d.title}</a>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Histórico de coletas" intro="Cada vez que o sistema buscou dados nesta fonte, e o que aconteceu.">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Início</th>
                    <th>Situação</th>
                    <th>Registros</th>
                    <th>Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.startedAt)}</td>
                      <td>{STATUS_LABEL[r.status]}</td>
                      <td className="num">{r.recordsCount.toLocaleString('pt-BR')}</td>
                      <td>{r.issues.length ? r.issues.slice(0, 3).join(' | ') : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </Async>
  );
}
