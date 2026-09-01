const CACHE_NAME = "ders-takip-v1";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon192.png",
  "./icons/icon512.png"
];

// Install Event - Cache dosyalarını kaydeder
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("Cache başarıyla açıldı");
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Eski cache'leri temizler
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log("Eski cache siliniyor:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Cache'den veya internetten dosyaları getirir
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache'de varsa döndür, yoksa internetten al
        return response || fetch(event.request)
          .then(fetchResponse => {
            // Sadece başarılı yanıtları cache'le
            if (fetchResponse && fetchResponse.status === 200) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return fetchResponse;
          })
          .catch(() => {
            // Offline durumu için (opsiyonel)
            console.log("Offline - istek başarısız:", event.request.url);
          });
      })
  );
});