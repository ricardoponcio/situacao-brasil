import { useMemo, useState } from 'react';
import type { Entity } from '@sb/core';
import type { ViewDefinition, ViewProps } from './types.ts';

interface Options {
  /** Atributos mostrados como coluna; padrão: todos os do primeiro registro. */
  columns?: string[];
  pageSize?: number;
}

const show = (v: unknown) => (v === null || v === undefined ? '–' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Tabela genérica de entidades, com busca e paginação. */
function Table({ descriptor, records, mode }: ViewProps) {
  const opts = descriptor.view.options as Options;
  const pageSize = mode === 'card' ? 8 : (opts.pageSize ?? 30);
  const rows = records.filter((r): r is Entity => r.kind === 'entity');
  const columns = opts.columns ?? Object.keys(rows[0]?.attributes ?? {});
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('pt-BR');
    const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (!term) return sorted;
    return sorted.filter(
      (r) => r.name.toLocaleLowerCase('pt-BR').includes(term) || r.territory?.code.includes(term) ||
        columns.some((c) => show(r.attributes[c]).toLocaleLowerCase('pt-BR').includes(term)),
    );
  }, [rows, q, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * pageSize, (current + 1) * pageSize);

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
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Código</th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="num">{r.territory?.code ?? '–'}</td>
                {columns.map((c) => (
                  <td key={c}>{show(r.attributes[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  component: Table,
};
