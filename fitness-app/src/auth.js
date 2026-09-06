// Autenticacao: hash de senha com scrypt e sessoes opacas em cookie HttpOnly.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { executar, um } from './db.js';
import { unauthorized } from './lib/http.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const COOKIE_SESSAO = 'fit_sessao';
export const DURACAO_SESSAO_DIAS = 30;

export function gerarHashSenha(senha) {
  const salt = randomBytes(16);
  const derivada = scryptSync(senha, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${derivada.toString('base64')}`;
}

export function verificarSenha(senha, hashArmazenado) {
  try {
    const [algoritmo, n, r, p, saltB64, chaveB64] = hashArmazenado.split('$');
    if (algoritmo !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const esperada = Buffer.from(chaveB64, 'base64');
    const derivada = scryptSync(senha, salt, esperada.length, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    return derivada.length === esperada.length && timingSafeEqual(derivada, esperada);
  } catch {
    return false;
  }
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function criarSessao(db, usuarioId) {
  const token = randomBytes(32).toString('base64url');
  const agora = new Date();
  const expira = new Date(agora.getTime() + DURACAO_SESSAO_DIAS * 24 * 60 * 60 * 1000);
  executar(
    db,
    'INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em) VALUES (?, ?, ?, ?)',
    hashToken(token), usuarioId, agora.toISOString(), expira.toISOString(),
  );
  return { token, expira };
}

export function encerrarSessao(db, token) {
  if (!token) return;
  executar(db, 'DELETE FROM sessoes WHERE token_hash = ?', hashToken(token));
}

export function usuarioPorToken(db, token) {
  if (!token) return null;
  const linha = um(
    db,
    `SELECT u.id, u.nome, u.email, s.expira_em
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ?`,
    hashToken(token),
  );
  if (!linha) return null;
  if (new Date(linha.expira_em) < new Date()) {
    encerrarSessao(db, token);
    return null;
  }
  return { id: linha.id, nome: linha.nome, email: linha.email };
}

export function limparSessoesExpiradas(db) {
  executar(db, 'DELETE FROM sessoes WHERE expira_em < ?', new Date().toISOString());
}

export function exigirUsuario(ctx) {
  if (!ctx.usuario) throw unauthorized();
  return ctx.usuario;
}
