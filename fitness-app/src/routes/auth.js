// Rotas de conta: cadastro, login, logout e usuario atual.
import { conflict, unauthorized, setCookie, badRequest } from '../lib/http.js';
import { str } from '../lib/validate.js';
import { executar, um } from '../db.js';
import { semearUsuario } from '../seed.js';
import {
  gerarHashSenha, verificarSenha, criarSessao, encerrarSessao,
  COOKIE_SESSAO, DURACAO_SESSAO_DIAS,
} from '../auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarEmail(valor) {
  const email = str(valor, 'email', { max: 160 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw badRequest('E-mail invalido');
  return email;
}

function validarSenha(valor) {
  const senha = str(valor, 'senha', { max: 200, min: 8 });
  if (senha.length < 8) throw badRequest('A senha deve ter ao menos 8 caracteres');
  return senha;
}

function definirCookie(res, token) {
  setCookie(res, COOKIE_SESSAO, token, {
    maxAge: DURACAO_SESSAO_DIAS * 24 * 60 * 60,
    secure: process.env.COOKIE_SECURE === '1',
  });
}

export default function registrarRotasAuth(router) {
  router.post('/api/auth/cadastro', async (ctx) => {
    const corpo = await ctx.body();
    const nome = str(corpo.nome, 'nome', { max: 80 });
    const email = validarEmail(corpo.email);
    const senha = validarSenha(corpo.senha);

    if (um(ctx.db, 'SELECT id FROM usuarios WHERE email = ?', email)) {
      throw conflict('Ja existe uma conta com este e-mail');
    }

    const { id } = executar(
      ctx.db,
      'INSERT INTO usuarios (nome, email, senha_hash, criado_em) VALUES (?, ?, ?, ?)',
      nome, email, gerarHashSenha(senha), new Date().toISOString(),
    );
    semearUsuario(ctx.db, id);

    const { token } = criarSessao(ctx.db, id);
    definirCookie(ctx.res, token);
    return { status: 201, dados: { usuario: { id, nome, email } } };
  });

  router.post('/api/auth/login', async (ctx) => {
    const corpo = await ctx.body();
    const email = validarEmail(corpo.email);
    const senha = str(corpo.senha, 'senha', { max: 200 });

    const usuario = um(ctx.db, 'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?', email);
    if (!usuario || !verificarSenha(senha, usuario.senha_hash)) {
      throw unauthorized('E-mail ou senha incorretos');
    }

    const { token } = criarSessao(ctx.db, usuario.id);
    definirCookie(ctx.res, token);
    return { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } };
  });

  router.post('/api/auth/logout', (ctx) => {
    encerrarSessao(ctx.db, ctx.token);
    setCookie(ctx.res, COOKIE_SESSAO, '', { maxAge: 0 });
    return { ok: true };
  });

  router.get('/api/auth/eu', (ctx) => ({ usuario: ctx.usuario ?? null }));
}
