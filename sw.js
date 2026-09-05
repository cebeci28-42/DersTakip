// sw.js - Service Worker
const CACHE_NAME = 'ders-takip-v3';
const ASSETS = [
    '/index.html',
    '/',
    '/widget-helper.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache açıldı');
                return cache.addAll(ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker kuruldu');
                return self.skipWaiting();
            })
            .catch(err => {
                console.warn('⚠️ Cache hatası:', err);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('🗑️ Eski cache silindi:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker aktif');
                return self.clients.claim();
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request)
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseClone);
                                })
                                .catch(err => {
                                    console.warn('⚠️ Cache kaydetme hatası:', err);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(error => {
                        console.warn('⚠️ Network hatası, offline mod:', error);
                        return new Response('Offline - Ders Takip', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Push bildirimleri
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || '📚 Ders Takip';
    const options = {
        body: data.body || 'Yaklaşan dersiniz var!',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        data: data.data || {},
        actions: [
            { action: 'open', title: '📖 Dersleri Gör' },
            { action: 'dismiss', title: 'Kapat' }
        ],
        requireInteraction: true,
        tag: 'ders-bildirim',
        renotify: true
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/index.html')
        );
    }
});

// Widget'dan gelen mesajlar
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'UPDATE_WIDGET') {
        console.log('📱 Widget verileri güncelleniyor...');
        // Verileri cache'le
        caches.open(CACHE_NAME).then(cache => {
            const response = new Response(JSON.stringify({
                lessons: event.data.lessons,
                students: event.data.students
            }));
            cache.put('/widget-data.json', response);
        });
    }
});