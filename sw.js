// sw.js - Service Worker
const CACHE_NAME = 'ders-takip-v3';
const ASSETS = [
    '/index.html',
    '/',
    '/widget.html',
    '/widget.js'
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
    }
});

// Widget'dan gelen mesajları dinle
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'GET_LESSONS') {
        // Widget'dan ders bilgisi istendi
        console.log('📱 Widget ders bilgisi istiyor');
        
        // Cache'ten verileri al
        caches.open(CACHE_NAME).then(cache => {
            cache.match('/index.html').then(response => {
                if (response) {
                    // Ders bilgilerini widget'a gönder
                    event.ports[0].postMessage({
                        type: 'LESSONS_DATA',
                        data: getUpcomingLessons()
                    });
                }
            });
        });
    }
});

// Yaklaşan dersleri getir
function getUpcomingLessons() {
    try {
        // localStorage'dan dersleri al
        const storedLessons = localStorage.getItem('math_tutor_lessons');
        const lessons = storedLessons ? JSON.parse(storedLessons) : [];
        const storedStudents = localStorage.getItem('math_tutor_students');
        const students = storedStudents ? JSON.parse(storedStudents) : [];
        
        const now = new Date();
        const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const upcoming = lessons
            .filter(l => !l.completed && l.date && l.time)
            .filter(l => {
                try {
                    const d = new Date(l.date + 'T' + (l.time || '00:00'));
                    return d >= now && d <= next24;
                } catch(e) { return false; }
            })
            .sort((a,b) => {
                try {
                    const da = new Date(a.date + 'T' + (a.time || '00:00'));
                    const db = new Date(b.date + 'T' + (b.time || '00:00'));
                    return da - db;
                } catch(e) { return 0; }
            })
            .map(l => {
                const student = students.find(s => s.id === l.studentId);
                const name = student ? `${student.name} ${student.surname}` : '(Silinmiş)';
                return {
                    id: l.id,
                    studentName: name,
                    date: formatDate(l.date),
                    time: l.time || 'belirtilmedi',
                    subject: l.subject || 'Ders',
                    fee: l.fee || 0
                };
            });
        
        return upcoming;
    } catch(e) {
        console.warn('Widget ders getirme hatası:', e);
        return [];
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch(e) {
        return dateStr;
    }
}

// Periyodik kontrol (arka planda)
self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-lessons') {
        event.waitUntil(checkUpcomingLessons());
    }
});

async function checkUpcomingLessons() {
    try {
        const lessons = getUpcomingLessons();
        if (lessons.length > 0) {
            self.registration.showNotification('⏰ Ders Hatırlatma', {
                body: `${lessons.length} yaklaşan dersiniz var!`,
                icon: 'icon-192.png',
                badge: 'icon-192.png',
                vibrate: [200, 100, 200],
                requireInteraction: true,
                data: { lessons: lessons }
            });
        }
    } catch(e) {
        console.warn('Periyodik kontrol hatası:', e);
    }
}