'use strict';

const CACHE_NAME = 'efv-solar-v4';

const ASSETS_PARA_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './solar-animation.js',
  './manifest.json',
  './assets/efv_solar.png',
  './assets/icon.svg',
  './assets/three.min.js',
];

/* Instala o SW e pré-armazena os assets */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_PARA_CACHE))
  );
  self.skipWaiting();
});

/* Remove caches antigos ao ativar nova versão */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((chave) => chave !== CACHE_NAME)
          .map((chave) => caches.delete(chave))
      )
    )
  );
  self.clients.claim();
});

/* Cache-first: serve do cache, busca na rede se não encontrar */
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached ?? fetch(event.request)
    )
  );
});
