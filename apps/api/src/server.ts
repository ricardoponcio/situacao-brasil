import { createServer } from 'node:http';
import type { DatasetDetail, SourceSummary, TerritoryLevel } from '@sb/core';
import { TerritoryLevel as TerritoryLevelSchema } from '@sb/core';
import { Storage } from '@sb/storage';
import { HttpError, Router } from './Router.ts';

const storage = new Storage();
const { catalog, records, runs, raw } = storage;

function summarizeSource(id: string): SourceSummary {
  const manifest = catalog.getSource(id);
  if (!manifest) throw new HttpError(404, `Fonte não encontrada: ${id}`);
  return { manifest, datasets: catalog.listDatasets({ sourceId: id }), lastRun: runs.last(id) };
}

function optLevel(v: string | null): TerritoryLevel | undefined {
  if (v === null) return undefined;
  const parsed = TerritoryLevelSchema.safeParse(v);
  if (!parsed.success) throw new HttpError(400, `level inválido: ${v}`);
  return parsed.data;
}

const router = new Router()
  .get('/api/health', () => ({ ok: true }))

  // Catálogo / auditoria
  .get('/api/sources', () => catalog.listSources().map((s) => summarizeSource(s.id)))
  .get('/api/sources/:id', ({ params }) => ({ ...summarizeSource(params.id!), runs: runs.list(params.id) }))
  .get('/api/runs', ({ query }) => runs.list(query.get('source') ?? undefined, 50))

  .get('/api/datasets', ({ query }) => {
    const theme = query.get('theme');
    const layer = query.get('layer');
    return catalog
      .listDatasets()
      .filter((d) => (!theme || d.theme === theme) && (!layer || d.layer === layer))
      .map((d) => ({ descriptor: d, stats: records.stats(d.id) }));
  })
  .get('/api/datasets/:id', ({ params }): DatasetDetail => {
    const descriptor = catalog.getDataset(params.id!);
    if (!descriptor) throw new HttpError(404, `Dataset não encontrado: ${params.id}`);
    const source = catalog.getSource(descriptor.sourceId)!;
    return { descriptor, source, stats: records.stats(descriptor.id) };
  })

  // Registros: mesma consulta para qualquer tipo de dado
  .get('/api/datasets/:id/records', ({ params, query }) => {
    if (!catalog.getDataset(params.id!)) throw new HttpError(404, `Dataset não encontrado: ${params.id}`);
    return {
      datasetId: params.id,
      records: records.query({
        datasetId: params.id,
        territoryLevel: optLevel(query.get('level')),
        territoryCode: query.get('territory') ?? undefined,
        from: query.get('from') ?? undefined,
        to: query.get('to') ?? undefined,
        order: query.get('order') === 'asc' ? 'asc' : 'desc',
        limit: Number(query.get('limit') ?? 500),
      }),
    };
  })

  // "O que aconteceu": eventos de todas as fontes, mais recentes primeiro
  .get('/api/feed', ({ query }) => records.query({ kind: 'event', limit: Number(query.get('limit') ?? 50) }))

  // Payload bruto exatamente como veio da origem
  .get('/api/raw/:hash', ({ params, query }) => {
    const blob = raw.read(params.hash!);
    if (!blob) throw new HttpError(404, 'Bruto não encontrado');
    if (query.get('info') !== null) return blob.info;
    return { raw: blob.body, contentType: blob.info.contentType };
  });

const port = Number(process.env.PORT ?? 3101);
createServer((req, res) => void router.handle(req, res)).listen(port, () => {
  console.log(`API em http://localhost:${port}/api`);
});
