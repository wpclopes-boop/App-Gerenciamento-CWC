// Service worker: deixa a casca do app disponivel offline.
// Dados da API nunca sao cacheados — sempre vao para a rede.
const VERSAO = 'fitness-v1';
const CASCA = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/views/painel.js',
  '/js/views/dieta.js',
  '/js/views/treino.js',
  '/js/views/progresso.js',
  '/js/views/metas.js',
  '/manifest.webmanifest',
  '/icons/icone-192.png',
  '/icons/icone-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO)
      .then((cache) => cache.addAll(CASCA))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;     // CDNs: deixa o navegador resolver
  if (url.pathname.startsWith('/api/')) return;         // dados sempre da rede

  // Navegacao: tenta a rede e cai para a casca offline.
  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      fetch(requisicao).catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // Estaticos: responde do cache e atualiza em segundo plano.
  evento.respondWith(
    caches.match(requisicao).then((cacheado) => {
      const rede = fetch(requisicao).then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(VERSAO).then((cache) => cache.put(requisicao, copia));
        }
        return resposta;
      }).catch(() => cacheado);
      return cacheado || rede;
    }),
  );
});
