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
-- Eventos da mesma proposta em fontes diferentes (EventSubject.ref).
CREATE INDEX IF NOT EXISTS idx_records_subject_ref ON records(json_extract(payload, '$.subject.ref'));

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

-- Texto oficial de cada proposta, por Casa (a versão muda quando passa de uma Casa à outra).
-- Só os artigos: a justificação é o argumento do autor e fica de fora.
CREATE TABLE IF NOT EXISTS propostas_textos (
  ref         TEXT NOT NULL,
  casa        TEXT NOT NULL,
  url         TEXT,
  raw_hash    TEXT,
  texto_hash  TEXT,
  texto       TEXT NOT NULL DEFAULT '',
  problema    TEXT,
  fetched_at  TEXT NOT NULL,
  PRIMARY KEY (ref, casa)
);

-- Resumo em linguagem simples, feito por IA a partir de um texto (mesmo texto, mesmo resumo).
-- Vem também do arquivo versionado apps/ingest/dados/resumos-propostas.json (o servidor não tem os textos).
CREATE TABLE IF NOT EXISTS propostas_resumos (
  texto_hash    TEXT PRIMARY KEY,
  ref           TEXT NOT NULL,
  casa          TEXT NOT NULL,
  texto_url     TEXT,
  titulo        TEXT NOT NULL,
  descricao     TEXT NOT NULL,
  modelo        TEXT NOT NULL,
  versao_prompt TEXT NOT NULL,
  criado_em     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_propostas_resumos_ref ON propostas_resumos(ref);
`;

export function openDatabase(file = dbPath): DatabaseSync {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}
