ملف الإصلاحات (مطبّقة فوق نسخة wasslatvTOW-22)

1-core-patch/core-fixes.patch   ← إصلاحات المشغل المصغّر + الشريط العلوي للشاشات القصيرة + إخفاء «مقترح لك» في الأندرويد.
   الأمر من جذر المشروع:  patch -p1 -l < 1-core-patch/core-fixes.patch
   (يعدّل css/vod.css و css/vodplay.css و public/js/vod.js فقط، ويضيف قواعد في آخر ملفي CSS دون المساس بما قبلها)

2-sync-android-assets/   ← يُنسخ فوق app/src/main/assets  (مزامنة الأندرويد مع JS الأحدث + index.html المحوَّل).
   مطلوب حتى يتطابق تطبيق الأندرويد مع نسخة public/js. يتضمن assets/css/vod.css و vodplay.css المصلَحين أيضًا.

3-extras/   ← اختبارات app/src/test/js (12 اختبارًا) + public/css لمعاينة الويب.

احذف من app/src/main/assets/js الملفين: vod-remote.test.js و vod-ui-fix.patch
