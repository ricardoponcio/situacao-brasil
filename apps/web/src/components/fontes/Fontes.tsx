/** Peças das páginas de fontes: ficha da fonte, situação da coleta, dados que vêm dela e histórico. */
import type { RunSummary, SourceManifest } from '@sb/core';
import { FREQUENCY_LABEL, formatDateTime, timeAgo } from '../../lib/format.ts';
import { href } from '../../lib/router.ts';
import { ACCESS_LABEL, AUTH_LABEL, RUN_STATUS_LABEL, runIssuesLine, runStatusClass } from '../../controllers/registros.ts';
import { BulletList, Facts, Table } from '../ui.tsx';

/** "parcial (com avisos) · há 2 horas · 230 registros". */
export function RunStatus({ run }: { run: RunSummary | null }) {
  if (!run) return <span className="muted">nunca coletado</span>;
  return (
    <span>
      <span className={runStatusClass(run.status)}>{RUN_STATUS_LABEL[run.status]}</span> · {timeAgo(run.startedAt)} ·{' '}
      {run.recordsCount.toLocaleString('pt-BR')} registros
    </span>
  );
}

export function ManifestFacts({ m }: { m: SourceManifest }) {
  return (
    <Facts
      rows={[
        ['Responsável', m.publisher],
        ['Acesso', `${ACCESS_LABEL[m.access.method]}, ${AUTH_LABEL[m.access.auth]}`],
        ['Publica dados', FREQUENCY_LABEL[m.publishFrequency]],
        ['Licença', m.license],
        [
          'Links',
          <>
            <a href={m.homepage} target="_blank" rel="noreferrer">
              site
            </a>{' '}
            ·{' '}
            <a href={m.docsUrl} target="_blank" rel="noreferrer">
              documentação
            </a>
          </>,
        ],
      ]}
    />
  );
}

/** Lista de links para os dados de uma fonte. */
export function DatasetLinks({ datasets }: { datasets: { id: string; title: string }[] }) {
  return <BulletList items={datasets.map((d) => ({ key: d.id, content: <a href={href.dataset(d.id)}>{d.title}</a> }))} />;
}

/** Cada vez que o sistema buscou dados na fonte, e o que aconteceu. */
export function RunsTable({ runs }: { runs: RunSummary[] }) {
  return (
    <Table head={['Início', 'Situação', 'Registros', 'Avisos']}>
      {runs.map((r) => (
        <tr key={r.id}>
          <td>{formatDateTime(r.startedAt)}</td>
          <td>{RUN_STATUS_LABEL[r.status]}</td>
          <td className="num">{r.recordsCount.toLocaleString('pt-BR')}</td>
          <td>{runIssuesLine(r)}</td>
        </tr>
      ))}
    </Table>
  );
}
