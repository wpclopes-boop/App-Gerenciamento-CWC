// Servidor HTTP: API JSON + entrega do front (sem dependencias externas).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDb } from './db.js';
import { limparSessoesExpiradas, usuarioPorToken, COOKIE_SESSAO } from './auth.js';
import { Router, HttpError, readJson, sendJson, parseCookies } from './lib/http.js';
import registrarRotasAuth from './routes/auth.js';
import registrarRotasPerfil from './routes/perfil.js';
import registrarRotasTreinos from './routes/treinos.js';
import registrarRotasNutricao from './routes/nutricao.js';
import registrarRotasCorpo from './routes/corpo.js';
import registrarRotasPainel from './routes/painel.js';

const raizProjeto = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR_PUBLICO = join(raizProjeto, 'public');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function criarRouter() {
  const router = new Router();
  registrarRotasAuth(router);
  registrarRotasPerfil(router);
  registrarRotasTreinos(router);
  registrarRotasNutricao(router);
  registrarRotasCorpo(router);
  registrarRotasPainel(router);
  return router;
}

async function servirEstatico(res, pathname) {
  const caminhoRelativo = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let arquivo = join(DIR_PUBLICO, caminhoRelativo);
  if (!arquivo.startsWith(DIR_PUBLICO)) {
    res.writeHead(403).end('Acesso negado');
    return;
  }

  try {
    const info = await stat(arquivo);
    if (info.isDirectory()) arquivo = join(arquivo, 'index.html');
  } catch {
    // Rotas do front (SPA) caem no index.html.
    arquivo = join(DIR_PUBLICO, 'index.html');
  }

  try {
    const conteudo = await readFile(arquivo);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream',
      'Content-Length': conteudo.length,
      'Cache-Control': extname(arquivo) === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(conteudo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nao encontrado');
  }
}

export function criarServidor(db = getDb()) {
  const router = criarRouter();

  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', CSP);

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (!url.pathname.startsWith('/api/')) {
      await servirEstatico(res, url.pathname === '/' ? '/index.html' : url.pathname);
      return;
    }

    try {
      const rota = router.match(req.method, url.pathname);
      if (!rota) throw new HttpError(404, 'Rota nao encontrada');

      const token = parseCookies(req)[COOKIE_SESSAO] || null;
      const ctx = {
        req,
        res,
        db,
        token,
        usuario: usuarioPorToken(db, token),
        params: rota.params,
        query: url.searchParams,
        body: () => readJson(req),
      };

      const resultado = await rota.handler(ctx);
      if (resultado === null || res.writableEnded) return;
      if (resultado && typeof resultado === 'object' && 'status' in resultado && 'dados' in resultado) {
        sendJson(res, resultado.status, resultado.dados);
      } else {
        sendJson(res, 200, resultado);
      }
    } catch (erro) {
      if (erro instanceof HttpError) {
        sendJson(res, erro.status, { erro: erro.message, detalhes: erro.details ?? null });
        return;
      }
      console.error('Erro inesperado:', erro);
      sendJson(res, 500, { erro: 'Erro interno do servidor' });
    }
  });
}

const executadoDiretamente = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executadoDiretamente) {
  const porta = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const db = getDb();
  limparSessoesExpiradas(db);
  setInterval(() => limparSessoesExpiradas(db), 6 * 60 * 60 * 1000).unref();

  criarServidor(db).listen(porta, host, () => {
    console.log(`Fitness App rodando em http://localhost:${porta}`);
  });
}
