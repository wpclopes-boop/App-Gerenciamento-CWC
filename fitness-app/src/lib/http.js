// Utilitarios HTTP: parsing de body, respostas JSON, cookies e roteamento por padrao.

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Nao autenticado') => new HttpError(401, msg);
export const notFound = (msg = 'Recurso nao encontrado') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

const MAX_BODY = 8 * 1024 * 1024; // 8MB: suficiente para uma foto de progresso

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Corpo da requisicao muito grande (max 8MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.length) return {};
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (parsed === null || typeof parsed !== 'object') throw new Error('esperado objeto');
    return parsed;
  } catch {
    throw badRequest('JSON invalido no corpo da requisicao');
  }
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data ?? null);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, secure = false } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (typeof maxAge === 'number') parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push('Secure');
  const existing = res.getHeader('Set-Cookie');
  const list = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  list.push(parts.join('; '));
  res.setHeader('Set-Cookie', list);
}

// Roteador minimalista com parametros nomeados: '/api/workouts/:id/items'
export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const keys = [];
    const regexSource = pattern
      .split('/')
      .map((segment) => {
        if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        keys.push(segment.slice(1));
        return '([^/]+)';
      })
      .join('/');
    this.routes.push({ method, regex: new RegExp(`^${regexSource}$`), keys, handler });
    return this;
  }

  get(pattern, handler) { return this.add('GET', pattern, handler); }
  post(pattern, handler) { return this.add('POST', pattern, handler); }
  put(pattern, handler) { return this.add('PUT', pattern, handler); }
  patch(pattern, handler) { return this.add('PATCH', pattern, handler); }
  delete(pattern, handler) { return this.add('DELETE', pattern, handler); }

  match(method, pathname) {
    let pathExists = false;
    for (const route of this.routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      pathExists = true;
      if (route.method !== method) continue;
      const params = {};
      route.keys.forEach((key, i) => { params[key] = decodeURIComponent(m[i + 1]); });
      return { handler: route.handler, params };
    }
    if (pathExists) throw new HttpError(405, 'Metodo nao permitido para esta rota');
    return null;
  }
}
