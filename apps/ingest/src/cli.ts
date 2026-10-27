/**
 * Uso:
 *   npm run ingest                      # roda todas as fontes
 *   npm run ingest -- ibge-sidra        # roda fontes específicas
 *   npm run ingest -- --list            # lista fontes e datasets
 *   npm run ingest -- camara-votacoes --opt dias=60
 */
import { Storage } from '@sb/storage';
import { loadProcessors } from './framework/registry.ts';
import { Runner } from './framework/Runner.ts';

const args = process.argv.slice(2);
const options: Record<string, string> = {};
const ids: string[] = [];
let list = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === '--list') list = true;
  else if (a === '--opt') {
    const [k, v] = (args[++i] ?? '').split('=');
    if (k && v !== undefined) options[k] = v;
  } else ids.push(a);
}

const processors = await loadProcessors();

// Referências cruzadas ("leia junto") precisam apontar para datasets que existem.
const allIds = new Set(processors.flatMap((p) => p.datasets().map((d) => d.id)));
for (const p of processors)
  for (const d of p.datasets())
    for (const r of d.readWith)
      if (!allIds.has(r.datasetId)) console.warn(`! ${d.id}: readWith aponta para dataset inexistente "${r.datasetId}"`);

if (list) {
  for (const p of processors) {
    console.log(`${p.manifest.id}  (${p.manifest.publisher})`);
    for (const d of p.datasets()) console.log(`   - ${d.id}: ${d.title}`);
  }
  process.exit(0);
}

const selected = ids.length ? processors.filter((p) => ids.includes(p.manifest.id)) : processors;
const unknown = ids.filter((id) => !processors.some((p) => p.manifest.id === id));
if (unknown.length) {
  console.error(`Fonte(s) desconhecida(s): ${unknown.join(', ')}. Use --list.`);
  process.exit(1);
}

const storage = new Storage();
const runner = new Runner(storage, options);
let failed = false;
for (const p of selected) {
  console.log(`> ${p.manifest.id}`);
  const t0 = Date.now();
  const out = await runner.run(p);
  failed ||= out.status === 'error';
  console.log(`  ${out.status}: ${out.records} registros, ${out.issues.length} problemas, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
storage.close();
process.exit(failed ? 1 : 0);
