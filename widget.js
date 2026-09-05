// widget.js - Android Widget için
(function() {
    'use strict';

    // Widget verilerini güncelle
    function updateWidget() {
        try {
            const widgetContainer = document.getElementById('widget-lessons');
            if (!widgetContainer) return;

            // localStorage'dan verileri al
            const storedLessons = localStorage.getItem('math_tutor_lessons');
            const lessons = storedLessons ? JSON.parse(storedLessons) : [];
            const storedStudents = localStorage.getItem('math_tutor_students');
            const students = storedStudents ? JSON.parse(storedStudents) : [];

            const now = new Date();
            const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Yaklaşan dersleri filtrele
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
                });

            // Widget içeriğini güncelle
            if (upcoming.length === 0) {
                widgetContainer.innerHTML = `
                    <div class="widget-empty">
                        <span class="widget-emoji">✅</span>
                        <p>24 saat içinde ders yok</p>
                    </div>
                `;
            } else {
                let html = '';
                upcoming.forEach(l => {
                    const student = students.find(s => s.id === l.studentId);
                    const name = student ? `${student.name} ${student.surname}` : 'Silinmiş';
                    const timeStr = l.time || 'belirtilmedi';
                    const subjectStr = l.subject || 'Ders';
                    const feeStr = l.fee ? `${l.fee} ₺` : '';

                    html += `
                        <div class="widget-lesson-item" onclick="openApp()">
                            <div class="widget-lesson-time">${timeStr}</div>
                            <div class="widget-lesson-info">
                                <div class="widget-lesson-name">${name}</div>
                                <div class="widget-lesson-subject">📖 ${subjectStr}</div>
                            </div>
                            ${feeStr ? `<div class="widget-lesson-fee">${feeStr}</div>` : ''}
                        </div>
                    `;
                });
                widgetContainer.innerHTML = html;
            }

            // Güncelleme zamanını göster
            const updateTime = document.getElementById('widget-update-time');
            if (updateTime) {
                const nowStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                updateTime.textContent = `🔄 ${nowStr}`;
            }

        } catch(e) {
            console.warn('Widget güncelleme hatası:', e);
            const widgetContainer = document.getElementById('widget-lessons');
            if (widgetContainer) {
                widgetContainer.innerHTML = `
                    <div class="widget-empty">
                        <span class="widget-emoji">⚠️</span>
                        <p>Veri yüklenemedi</p>
                    </div>
                `;
            }
        }
    }

    // Uygulamayı aç
    window.openApp = function() {
        if (window.parent) {
            window.parent.postMessage({ type: 'OPEN_APP' }, '*');
        }
        // Ana uygulamayı aç
        window.location.href = '/index.html';
    };

    // Widget'ı yenile
    window.refreshWidget = function() {
        updateWidget();
        // Service Worker'a mesaj gönder
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const channel = new MessageChannel();
            channel.port1.onmessage = function(event) {
                if (event.data && event.data.type === 'LESSONS_DATA') {
                    // Veriler geldiğinde güncelle
                    updateWidget();
                }
            };
            navigator.serviceWorker.controller.postMessage({
                type: 'GET_LESSONS'
            }, [channel.port2]);
        }
    };

    // Her 5 dakikada bir güncelle
    setInterval(updateWidget, 5 * 60 * 1000);

    // Sayfa yüklendiğinde güncelle
    document.addEventListener('DOMContentLoaded', function() {
        updateWidget();
        // Service Worker'ı kontrol et
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(() => {
                setTimeout(refreshWidget, 1000);
            });
        }
    });

    // Widget'dan bildirim gönder
    window.sendWidgetNotification = function() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CHECK_LESSONS'
            });
        }
        // Bildirim göster
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('📱 Ders Takip Widget', {
                body: 'Yaklaşan derslerinizi kontrol edin!',
                icon: 'icon-192.png',
                vibrate: [200, 100, 200]
            });
        }
        updateWidget();
    };

    // localStorage değişikliklerini dinle
    window.addEventListener('storage', function(e) {
        if (e.key === 'math_tutor_lessons' || e.key === 'math_tutor_students') {
            updateWidget();
        }
    });

})();