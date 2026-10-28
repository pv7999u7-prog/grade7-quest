// 離線快取：更新題庫或程式後，把 VERSION 改一下，iPad 下次連網開啟時就會換成新版
// 同一個網域上可能還有其他 App，快取只清自己（PREFIX 開頭）的舊版本
const PREFIX = 'g7q-';
const VERSION = PREFIX + 'v9';
const FILES = ['./', 'index.html', 'app.js', 'chapters.js', 'questions.js', 'pet.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 先用網路拿最新版，沒網路時才用快取
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
