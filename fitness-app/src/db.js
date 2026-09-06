// Banco SQLite (node:sqlite, sem dependencias externas): schema e conexao.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizProjeto = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em TEXT NOT NULL,
  expira_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);

CREATE TABLE IF NOT EXISTS perfis (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  sexo TEXT,
  data_nascimento TEXT,
  altura_cm REAL,
  peso_inicial REAL,
  peso_meta REAL,
  nivel_atividade TEXT NOT NULL DEFAULT 'moderado',
  objetivo TEXT NOT NULL DEFAULT 'manutencao',
  metas_personalizadas INTEGER NOT NULL DEFAULT 0,
  meta_kcal REAL,
  meta_proteina_g REAL,
  meta_carbo_g REAL,
  meta_gordura_g REAL,
  meta_agua_ml REAL,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS exercicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  grupo_muscular TEXT,
  equipamento TEXT,
  UNIQUE (usuario_id, nome)
);

CREATE TABLE IF NOT EXISTS treinos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  letra TEXT,
  cor TEXT NOT NULL DEFAULT 'fire',
  observacoes TEXT,
  posicao INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_treinos_usuario ON treinos(usuario_id);

CREATE TABLE IF NOT EXISTS treino_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  treino_id INTEGER NOT NULL REFERENCES treinos(id) ON DELETE CASCADE,
  exercicio_id INTEGER NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
  series TEXT,
  repeticoes TEXT,
  descanso TEXT,
  observacoes TEXT,
  posicao INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_treino_itens_treino ON treino_itens(treino_id);

CREATE TABLE IF NOT EXISTS series_registradas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  exercicio_id INTEGER NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
  treino_id INTEGER REFERENCES treinos(id) ON DELETE SET NULL,
  data TEXT NOT NULL,
  peso REAL NOT NULL,
  repeticoes INTEGER NOT NULL,
  observacoes TEXT,
  criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_series_usuario_data ON series_registradas(usuario_id, data);
CREATE INDEX IF NOT EXISTS idx_series_exercicio ON series_registradas(exercicio_id);

CREATE TABLE IF NOT EXISTS alimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'g',
  porcao_base REAL NOT NULL DEFAULT 100,
  kcal REAL NOT NULL DEFAULT 0,
  proteina_g REAL NOT NULL DEFAULT 0,
  carbo_g REAL NOT NULL DEFAULT 0,
  gordura_g REAL NOT NULL DEFAULT 0,
  UNIQUE (usuario_id, nome)
);

CREATE TABLE IF NOT EXISTS planos_dia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT NOT NULL DEFAULT 'fire',
  posicao INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_planos_usuario ON planos_dia(usuario_id);

CREATE TABLE IF NOT EXISTS plano_refeicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plano_id INTEGER NOT NULL REFERENCES planos_dia(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dica TEXT,
  posicao INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_plano_refeicoes_plano ON plano_refeicoes(plano_id);

CREATE TABLE IF NOT EXISTS plano_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refeicao_id INTEGER NOT NULL REFERENCES plano_refeicoes(id) ON DELETE CASCADE,
  alimento_id INTEGER NOT NULL REFERENCES alimentos(id) ON DELETE CASCADE,
  quantidade REAL NOT NULL,
  posicao INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_plano_itens_refeicao ON plano_itens(refeicao_id);

CREATE TABLE IF NOT EXISTS diario_refeicoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  refeicao TEXT NOT NULL,
  alimento_id INTEGER REFERENCES alimentos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'g',
  kcal REAL NOT NULL DEFAULT 0,
  proteina_g REAL NOT NULL DEFAULT 0,
  carbo_g REAL NOT NULL DEFAULT 0,
  gordura_g REAL NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diario_usuario_data ON diario_refeicoes(usuario_id, data);

CREATE TABLE IF NOT EXISTS agua (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  ml REAL NOT NULL,
  criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agua_usuario_data ON agua(usuario_id, data);

CREATE TABLE IF NOT EXISTS medidas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  peso REAL,
  gordura_pct REAL,
  peito_cm REAL,
  cintura_cm REAL,
  quadril_cm REAL,
  braco_cm REAL,
  coxa_cm REAL,
  observacoes TEXT,
  criado_em TEXT NOT NULL,
  UNIQUE (usuario_id, data)
);
CREATE INDEX IF NOT EXISTS idx_medidas_usuario_data ON medidas(usuario_id, data);

CREATE TABLE IF NOT EXISTS fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  mime TEXT NOT NULL,
  conteudo BLOB NOT NULL,
  legenda TEXT,
  criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fotos_usuario_data ON fotos(usuario_id, data);
`;

let instancia = null;

export function abrirBanco(caminho = process.env.FITNESS_DB || resolve(raizProjeto, 'data/fitness.db')) {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec(SCHEMA);
  return db;
}

export function getDb() {
  if (!instancia) instancia = abrirBanco();
  return instancia;
}

export function fecharBanco() {
  if (instancia) {
    instancia.close();
    instancia = null;
  }
}

// Helpers: node:sqlite retorna BigInt em colunas INTEGER de agregacao/ids conforme o driver.
export function normalizar(linha) {
  if (!linha) return linha;
  const out = {};
  for (const [k, v] of Object.entries(linha)) out[k] = typeof v === 'bigint' ? Number(v) : v;
  return out;
}

export function todos(db, sql, ...params) {
  return db.prepare(sql).all(...params).map(normalizar);
}

export function um(db, sql, ...params) {
  return normalizar(db.prepare(sql).get(...params)) ?? null;
}

export function executar(db, sql, ...params) {
  const r = db.prepare(sql).run(...params);
  return { id: Number(r.lastInsertRowid), alteracoes: Number(r.changes) };
}
