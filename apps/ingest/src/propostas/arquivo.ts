import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PropostaResumo } from '@sb/core';
import type { Storage } from '@sb/storage';

/**
 * Os resumos são feitos fora do servidor (com o Claude do autor) e vão para o ar por este arquivo, versionado no git.
 * A coleta importa o arquivo para o banco a cada rodada.
 */
export const ARQUIVO_RESUMOS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../dados/resumos-propostas.json',
);

export function exportarResumos(storage: Storage): number {
  const todos = storage.resumos.all();
  mkdirSync(path.dirname(ARQUIVO_RESUMOS), { recursive: true });
  writeFileSync(ARQUIVO_RESUMOS, JSON.stringify(todos, null, 1) + '\n');
  return todos.length;
}

export function importarResumos(storage: Storage): number {
  if (!existsSync(ARQUIVO_RESUMOS)) return 0;
  const todos = JSON.parse(readFileSync(ARQUIVO_RESUMOS, 'utf8')) as PropostaResumo[];
  storage.resumos.upsertMany(todos);
  return todos.length;
}
