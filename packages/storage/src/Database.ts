import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dataDir, dbPath } from './paths.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sources (
  id          TEXT PRIMARY KEY,
  manifest    TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS datasets (
  id          TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL REFERENCES sources(id),
  descriptor  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Todos os registros, de qualquer tipo, numa tabela só.
-- Colunas extraídas (time_key, territory_*) existem só para filtrar/ordenar;
-- a verdade é o payload JSON (DTO genérica validada).
CREATE TABLE IF NOT EXISTS records (
  id              TEXT PRIMARY KEY,
  dataset_id      TEXT NOT NULL REFERENCES datasets(id),
  kind            TEXT NOT NULL,
  time_key        TEXT,
  territory_level TEXT,
  territory_code  TEXT,
  payload         TEXT NOT NULL,
  fetched_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_dataset_time ON records(dataset_id, time_key);
CREATE INDEX IF NOT EXISTS idx_records_kind_time ON records(kind, time_key);
CREATE INDEX IF NOT EXISTS idx_records_territory ON records(dataset_id, territory_level, territory_code);

CREATE TABLE IF NOT EXISTS runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id     TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  status        TEXT NOT NULL,
  records_count INTEGER NOT NULL DEFAULT 0,
  issues        TEXT NOT NULL DEFAULT '[]'
);

-- Índice dos payloads brutos arquivados em data/raw/<hash>
CREATE TABLE IF NOT EXISTS raw_blobs (
  hash         TEXT PRIMARY KEY,
  url          TEXT NOT NULL,
  fetched_at   TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  content_type TEXT NOT NULL
);
`;

export function openDatabase(file = dbPath): DatabaseSync {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}
