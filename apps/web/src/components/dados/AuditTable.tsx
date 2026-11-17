import { api } from '../../lib/api.ts';
import { useRecords } from '../../hooks/useDatasets.ts';
import { recordCells } from '../../controllers/registros.ts';
import { Async, Table } from '../ui.tsx';

/** Últimos registros com a proveniência completa de cada um. */
export function AuditTable({ datasetId, unit, decimals }: { datasetId: string; unit?: string; decimals: number }) {
  const state = useRecords(datasetId, { order: 'desc', limit: 50 });
  return (
    <Async state={state}>
      {({ records }) => (
        <Table head={['Referência', 'Valor / conteúdo', 'Origem']}>
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
        </Table>
      )}
    </Async>
  );
}
