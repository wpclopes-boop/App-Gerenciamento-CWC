// Backup do banco: snapshot consistente via VACUUM INTO, com rotacao por quantidade.
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizProjeto = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const PREFIXO = 'fitness-';

export function diretorioPadrao() {
  return process.env.FITNESS_BACKUP_DIR || resolve(raizProjeto, 'data/backups');
}

// Nome ordenavel por data: fitness-2026-09-03T12-05-00.db
function nomeDoArquivo(agora = new Date()) {
  return `${PREFIXO}${agora.toISOString().replace(/:/g, '-').replace(/\..+$/, '')}.db`;
}

export function listarBackups(diretorio = diretorioPadrao()) {
  try {
    return readdirSync(diretorio)
      .filter((nome) => nome.startsWith(PREFIXO) && nome.endsWith('.db'))
      .sort()
      .map((nome) => join(diretorio, nome));
  } catch {
    return [];
  }
}

// Mantem apenas os N backups mais recentes.
export function rotacionar(diretorio = diretorioPadrao(), manter = 7) {
  const arquivos = listarBackups(diretorio);
  const excedentes = arquivos.slice(0, Math.max(0, arquivos.length - manter));
  for (const arquivo of excedentes) {
    try { unlinkSync(arquivo); } catch { /* ja removido */ }
  }
  return excedentes;
}

export function fazerBackup(db, { diretorio = diretorioPadrao(), manter = 7, agora = new Date() } = {}) {
  mkdirSync(diretorio, { recursive: true });
  const destino = join(diretorio, nomeDoArquivo(agora));
  db.prepare('VACUUM INTO ?').run(destino);
  const removidos = rotacionar(diretorio, manter);
  return { arquivo: destino, bytes: statSync(destino).size, removidos: removidos.length };
}

// Um backup ao subir o servidor e outro a cada intervalo.
export function agendarBackups(db, { intervaloHoras = 24, manter = 7 } = {}) {
  const executar = () => {
    try {
      const { arquivo, bytes } = fazerBackup(db, { manter });
      console.log(`Backup do banco: ${arquivo} (${Math.round(bytes / 1024)} KB)`);
    } catch (erro) {
      console.error('Falha ao gerar backup:', erro.message);
    }
  };
  executar();
  return setInterval(executar, intervaloHoras * 60 * 60 * 1000).unref();
}
