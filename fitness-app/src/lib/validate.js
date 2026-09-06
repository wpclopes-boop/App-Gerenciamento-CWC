// Validacao de entrada: converte e limita valores vindos do cliente.
import { badRequest } from './http.js';

export function str(value, campo, { obrigatorio = true, max = 200, min = 1, padrao = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (obrigatorio) throw badRequest(`Campo "${campo}" e obrigatorio`);
    return padrao;
  }
  if (typeof value !== 'string') throw badRequest(`Campo "${campo}" deve ser texto`);
  const limpo = value.trim();
  if (limpo.length < min) throw badRequest(`Campo "${campo}" deve ter ao menos ${min} caractere(s)`);
  if (limpo.length > max) throw badRequest(`Campo "${campo}" excede ${max} caracteres`);
  return limpo;
}

export function num(value, campo, { obrigatorio = true, min = -1e9, max = 1e9, padrao = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (obrigatorio) throw badRequest(`Campo "${campo}" e obrigatorio`);
    return padrao;
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw badRequest(`Campo "${campo}" deve ser numerico`);
  if (n < min || n > max) throw badRequest(`Campo "${campo}" deve estar entre ${min} e ${max}`);
  return n;
}

export function int(value, campo, opts = {}) {
  const n = num(value, campo, opts);
  return n == null ? n : Math.round(n);
}

export function bool(value, padrao = false) {
  if (value === undefined || value === null) return padrao;
  return value === true || value === 1 || value === '1' || value === 'true';
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function data(value, campo, { obrigatorio = true, padrao = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (obrigatorio) throw badRequest(`Campo "${campo}" e obrigatorio`);
    return padrao;
  }
  if (typeof value !== 'string' || !DATA_RE.test(value)) {
    throw badRequest(`Campo "${campo}" deve estar no formato AAAA-MM-DD`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw badRequest(`Campo "${campo}" nao e uma data valida`);
  return value;
}

export function umDe(value, campo, opcoes, { obrigatorio = true, padrao = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (obrigatorio) throw badRequest(`Campo "${campo}" e obrigatorio`);
    return padrao;
  }
  if (!opcoes.includes(value)) {
    throw badRequest(`Campo "${campo}" deve ser um de: ${opcoes.join(', ')}`);
  }
  return value;
}

export function hoje() {
  return new Date().toISOString().slice(0, 10);
}
