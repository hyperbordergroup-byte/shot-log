// SHOT LOG: 圏外でもアプリを開くための Service Worker。
// 基本はネットワーク優先（更新がすぐ届くように）で、取得できないときだけ保存済みの内容を返す
const CACHE = 'shotlog-app-v1';
const WAIT_MS = 3000; // 回線が弱いときに待ち続けないための上限

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function fromCache(req) {
  const cache = await caches.open(CACHE);
  return (await cache.match(req)) || cache.match(req, { ignoreSearch: true });
}

async function fetchAndStore(req) {
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    const cache = await caches.open(CACHE);
    await cache.put(req, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 自分のファイルとsupabaseのライブラリだけを扱う（APIの通信は素通し）
  if (url.origin !== location.origin && url.hostname !== 'unpkg.com') return;
  e.respondWith((async () => {
    const network = fetchAndStore(req);
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), WAIT_MS));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch (err) { /* 圏外 */ }
    const cached = await fromCache(req);
    return cached || network;
  })());
});
