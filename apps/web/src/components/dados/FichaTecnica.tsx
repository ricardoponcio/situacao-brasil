import type { DatasetDescriptor, DatasetStats, SourceManifest } from '@sb/core';
import { FREQUENCY_LABEL, formatDate, formatDateTime } from '../../lib/format.ts';
import { href } from '../../lib/router.ts';
import { Facts } from '../ui.tsx';

/** Tudo o que é preciso para conferir o dado por conta própria: fonte, unidade, período, última coleta… */
export function FichaTecnica({ d, source, stats }: { d: DatasetDescriptor; source: SourceManifest; stats: DatasetStats }) {
  return (
    <Facts
      rows={[
        [
          'Fonte',
          <>
            <a href={href.source(source.id)}>{source.name}</a> ({source.publisher})
          </>,
        ],
        ['Atualizado pela fonte', FREQUENCY_LABEL[d.frequency] ?? d.frequency],
        ['Unidade', d.unit],
        ['Registros guardados', stats.count.toLocaleString('pt-BR')],
        [
          'Período coberto',
          stats.firstTime &&
            stats.lastTime &&
            `${formatDate(stats.firstTime.slice(0, 10))} a ${formatDate(stats.lastTime.slice(0, 10))}`,
        ],
        ['Última coleta', stats.lastFetchedAt && formatDateTime(stats.lastFetchedAt)],
        [
          'Documentação oficial',
          d.originDocs && (
            <a href={d.originDocs} target="_blank" rel="noreferrer">
              {new URL(d.originDocs).host}
            </a>
          ),
        ],
        ['Identificador', <code>{d.id}</code>],
      ]}
    />
  );
}
