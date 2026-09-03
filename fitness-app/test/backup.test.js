import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBanco, executar } from '../src/db.js';
import { fazerBackup, listarBackups } from '../src/backup.js';

function comBanco(t) {
  const diretorio = mkdtempSync(join(tmpdir(), 'fitness-backup-'));
  const db = abrirBanco(join(diretorio, 'fitness.db'));
  executar(db, 'INSERT INTO usuarios (nome, email, senha_hash, criado_em) VALUES (?, ?, ?, ?)',
    'Atleta', 'backup@teste.com', 'hash', new Date().toISOString());
  t.after(() => { db.close(); rmSync(diretorio, { recursive: true, force: true }); });
  return { db, diretorio: join(diretorio, 'backups') };
}

test('backup gera um arquivo legivel com os dados', (t) => {
  const { db, diretorio } = comBanco(t);

  const { arquivo, bytes } = fazerBackup(db, { diretorio });
  assert.ok(existsSync(arquivo));
  assert.ok(bytes > 0);

  // O backup abre como banco e mantem os dados.
  const copia = abrirBanco(arquivo);
  const { total } = copia.prepare('SELECT COUNT(*) AS total FROM usuarios').get();
  copia.close();
  assert.equal(Number(total), 1);
});

test('rotacao mantem apenas os backups mais recentes', (t) => {
  const { db, diretorio } = comBanco(t);

  for (let i = 0; i < 5; i += 1) {
    fazerBackup(db, { diretorio, manter: 3, agora: new Date(Date.UTC(2026, 0, 1, 0, 0, i)) });
  }

  const arquivos = listarBackups(diretorio);
  assert.equal(arquivos.length, 3);
  assert.ok(arquivos.at(-1).includes('2026-01-01T00-00-04'));  // o mais novo ficou
  assert.ok(!arquivos.some((a) => a.includes('2026-01-01T00-00-00')));  // o mais antigo saiu
});
