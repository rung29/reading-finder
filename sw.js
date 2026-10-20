const CACHE_NAME = 'reading-finder-v14';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data_source_config.js',
  './data_loader.js',
  './title_groups.js',
  './app.js',
  './manifest.json',
  './books.json',
  './icon.svg'
];

// 安裝 Service Worker 並快取靜態資源
self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      self.skipWaiting(),
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[Service Worker] Caching all assets');
        return cache.addAll(ASSETS);
      })
    ])
  );
});

// 啟用 Service Worker 並清理舊快取
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      ).then(() => self.clients.claim());
    })
  );
});

// 攔截請求並優先從快取載入，若無快取則發送網路請求
self.addEventListener('fetch', (e) => {
  const requestUrl = new URL(e.request.url);

  // 書單採 network-first：上線新版時先取最新資料，離線時再退回快取。
  if (requestUrl.pathname.endsWith('/books.json')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const exactMatch = await caches.match(e.request);
          return exactMatch || caches.match('./books.json');
        })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
