// sw.js - Service Worker
const CACHE_NAME = 'ders-takip-v2';
const ASSETS = [
    '/index.html',
    '/'
];

// Install event
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

// Activate event
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

// Fetch event
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

// PUSH BİLDİRİM - Widget için
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

// Notification click event
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/index.html')
        );
    } else {
        // Bildirim kapatıldı
        console.log('Bildirim kapatıldı');
    }
});

// Widget'dan gelen mesajları dinle
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CHECK_LESSONS') {
        // Widget'dan kontrol geldi
        console.log('📱 Widget kontrol ediyor:', event.data);
        // Bildirim gönder
        self.registration.showNotification('📚 Ders Takip', {
            body: '🎯 Bugün planlanmış derslerinizi kontrol edin!',
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            vibrate: [200, 100, 200],
            requireInteraction: false
        });
    }
});

// Periyodik kontrol (arka planda çalışır)
self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-lessons') {
        event.waitUntil(checkUpcomingLessons());
    }
});

async function checkUpcomingLessons() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match('/index.html');
        if (response) {
            // Dersleri kontrol et ve bildirim gönder
            const now = new Date();
            const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            // Örnek bildirim
            self.registration.showNotification('⏰ Ders Hatırlatma', {
                body: 'Önümüzdeki 24 saat içinde dersiniz var!',
                icon: 'icon-192.png',
                badge: 'icon-192.png',
                vibrate: [200, 100, 200],
                requireInteraction: true
            });
        }
    } catch(e) {
        console.warn('Periyodik kontrol hatası:', e);
    }
}