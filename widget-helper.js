// widget-helper.js - PWA'dan Widget'a veri gönderir

(function() {
    'use strict';

    // Widget'a veri gönder
    function sendDataToWidget() {
        try {
            const lessons = localStorage.getItem('math_tutor_lessons');
            const students = localStorage.getItem('math_tutor_students');
            
            if (!lessons || !students) {
                console.log('📱 Widget: Veri bulunamadı');
                return;
            }

            // Android WebView'de çalışıyorsa
            if (window.WidgetInterface) {
                window.WidgetInterface.sendDataToWidget(lessons, students);
                console.log('📱 Widget: Veriler gönderildi (WebView)');
            }
            
            // Service Worker üzerinden gönder
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'UPDATE_WIDGET',
                    lessons: lessons,
                    students: students
                });
                console.log('📱 Widget: Veriler gönderildi (Service Worker)');
            }
            
        } catch(e) {
            console.warn('Widget veri gönderme hatası:', e);
        }
    }

    // Veri değiştiğinde widget'ı güncelle
    function watchDataChanges() {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            originalSetItem.apply(this, arguments);
            if (key === 'math_tutor_lessons' || key === 'math_tutor_students') {
                setTimeout(sendDataToWidget, 500);
            }
        };
        
        window.addEventListener('storage', function(e) {
            if (e.key === 'math_tutor_lessons' || e.key === 'math_tutor_students') {
                setTimeout(sendDataToWidget, 500);
            }
        });
    }

    // Periyodik güncelleme (5 dakikada bir)
    function startPeriodicUpdate() {
        setTimeout(sendDataToWidget, 1000);
        setInterval(sendDataToWidget, 5 * 60 * 1000);
    }

    // 24 saat içindeki dersleri kontrol et (her saat)
    function checkUpcomingLessons() {
        try {
            const lessons = JSON.parse(localStorage.getItem('math_tutor_lessons') || '[]');
            const now = new Date();
            const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            const upcoming = lessons.filter(l => {
                if (!l.date || !l.time || l.completed) return false;
                try {
                    const d = new Date(l.date + 'T' + l.time);
                    return d >= now && d <= next24;
                } catch(e) { return false; }
            });
            
            if (upcoming.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
                const students = JSON.parse(localStorage.getItem('math_tutor_students') || '[]');
                const names = upcoming.map(l => {
                    const student = students.find(s => s.id === l.studentId);
                    return student ? `${student.name} ${student.surname}` : 'Silinmiş';
                });
                
                new Notification('📚 Yaklaşan Dersler', {
                    body: `${upcoming.length} dersiniz var: ${names.join(', ')}`,
                    icon: 'icon-192.png',
                    vibrate: [200, 100, 200]
                });
            }
            
            sendDataToWidget();
        } catch(e) {
            console.warn('Ders kontrol hatası:', e);
        }
    }

    // Başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            watchDataChanges();
            startPeriodicUpdate();
            setInterval(checkUpcomingLessons, 60 * 60 * 1000);
        });
    } else {
        watchDataChanges();
        startPeriodicUpdate();
        setInterval(checkUpcomingLessons, 60 * 60 * 1000);
    }

    // Global fonksiyon
    window.sendWidgetData = sendDataToWidget;
    
    console.log('✅ Widget Helper başlatıldı');
})();