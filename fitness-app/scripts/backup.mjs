// Backup manual do banco: node scripts/backup.mjs
import { getDb } from '../src/db.js';
import { fazerBackup, listarBackups } from '../src/backup.js';

const { arquivo, bytes, removidos } = fazerBackup(getDb());
console.log(`Backup criado: ${arquivo} (${Math.round(bytes / 1024)} KB)`);
if (removidos) console.log(`Backups antigos removidos: ${removidos}`);
console.log(`Total de backups guardados: ${listarBackups().length}`);
