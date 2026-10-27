import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Processor } from './Processor.ts';

const sourcesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../sources');

/**
 * Descobre fontes automaticamente: toda pasta em src/sources/<nome>/ com um index.ts
 * cujo `default` seja um Processor (ou lista deles) é registrada. Nada a editar aqui
 * para plugar uma fonte nova.
 */
export async function loadProcessors(): Promise<Processor[]> {
  const found: Processor[] = [];
  for (const dir of readdirSync(sourcesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const entry = path.join(sourcesDir, dir.name, 'index.ts');
    if (!existsSync(entry)) continue;
    const mod = (await import(pathToFileURL(entry).href)) as { default?: Processor | Processor[] };
    const exported = mod.default;
    if (!exported) throw new Error(`src/sources/${dir.name}/index.ts não tem export default`);
    found.push(...(Array.isArray(exported) ? exported : [exported]));
  }
  const ids = new Set<string>();
  for (const p of found) {
    if (ids.has(p.manifest.id)) throw new Error(`id de fonte duplicado: ${p.manifest.id}`);
    ids.add(p.manifest.id);
  }
  return found.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}
