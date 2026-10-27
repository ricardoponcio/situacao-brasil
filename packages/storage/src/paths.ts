import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Pasta de dados (banco + brutos). Sobrescreva com SB_DATA_DIR. */
export const dataDir = process.env.SB_DATA_DIR ?? path.join(repoRoot, 'data');
export const dbPath = path.join(dataDir, 'situacao.db');
export const rawDir = path.join(dataDir, 'raw');
