// Rota publica de saude, usada pelo health check da hospedagem.
import { um } from '../db.js';

export default function registrarRotasSistema(router) {
  router.get('/api/saude', (ctx) => {
    const banco = um(ctx.db, 'SELECT COUNT(*) AS total FROM usuarios');
    return { ok: true, banco: banco ? 'conectado' : 'indisponivel', em: new Date().toISOString() };
  });
}
