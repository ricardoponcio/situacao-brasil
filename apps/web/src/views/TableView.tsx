import { useMemo, useState } from 'react';
import { Table } from '../components/ui.tsx';
import { cellText, entities, entityColumns, filterEntities, paginate } from '../controllers/registros.ts';
import type { ViewDefinition, ViewProps } from './types.ts';

interface Options {
  /** Atributos mostrados como coluna; padrão: todos os do primeiro registro. */
  columns?: string[];
  pageSize?: number;
}

/** Tabela genérica de entidades, com busca e paginação. */
function EntityTable({ descriptor, records, mode }: ViewProps) {
  const opts = descriptor.view.options as Options;
  const pageSize = mode === 'card' ? 8 : (opts.pageSize ?? 30);
  const rows = entities(records);
  const columns = entityColumns(rows, opts.columns);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => filterEntities(rows, columns, q), [rows, q, columns]);
  const { pages, current, slice } = paginate(filtered, page, pageSize);

  return (
    <>
      {mode === 'full' && (
        <div className="toolbar">
          <input
            type="search"
            placeholder="Buscar por nome ou código"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
          <span>{filtered.length.toLocaleString('pt-BR')} itens</span>
        </div>
      )}
      <Table head={['Nome', 'Código', ...columns]}>
        {slice.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td className="num">{r.territory?.code ?? '–'}</td>
            {columns.map((c) => (
              <td key={c}>{cellText(r.attributes[c])}</td>
            ))}
          </tr>
        ))}
      </Table>
      {mode === 'full' && pages > 1 && (
        <div className="toolbar">
          <button className="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Anterior
          </button>
          <span>
            Página {current + 1} de {pages}
          </span>
          <button className="secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Próxima
          </button>
        </div>
      )}
    </>
  );
}

export const tableView: ViewDefinition = {
  query: (_d, mode) => ({ limit: mode === 'card' ? 8 : 10_000, order: 'asc' }),
  component: EntityTable,
};
