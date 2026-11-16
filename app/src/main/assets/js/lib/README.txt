للتشغيل بدون إنترنت ضع هنا الملفين التاليين:
  hls.min.js     <- https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js
  mpegts.min.js  <- https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js

تنبيه: كان hls.min.js نسخة مكررة من mpegts.min.js (خطأ) فحُذف.
عند البناء عبر GitHub Actions يُنزَّل hls.js الحقيقي تلقائياً ويُضمَّن في الـ APK.
إن غاب أي ملف أو كان خاطئاً يحمّله التطبيق من الإنترنت تلقائياً.
