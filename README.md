# وصلة TV (WasslaTV)

تطبيق Android TV لمشاهدة القنوات. الواجهة كلها في `app/src/main/assets` (HTML/CSS/JS) والغلاف الأصلي هو `WebActivity.kt`.

## هيكل المشروع
- `app/src/main/assets/channels.json` : قائمة القنوات المعتمدة المدمجة في التطبيق.
- `data/test/` : قوائم تجريبية (غير مدمجة في الـ APK): `builtin_channels.json`، `official_channels.json`.
- `app/src/main/assets/js/lib/` : مكتبات التشغيل (راجع README داخله).

## البناء
- عبر GitHub Actions (`.github/workflows/tow.yml`) أو محليًا بـ `gradle assembleRelease` (Gradle 8.9 وJDK 17).
- يبنى المشروع كـ APK غير موقّع ولا يعتمد على JKS أو أسرار توقيع. يرفع GitHub Actions الـ Artifact مع تحذير إذا كان غير موقّع، دون إفشال البناء.
- تثبيت تحديث فوق نسخة سابقة يتطلب توقيع APK بمفتاح الإصدار السابق نفسه؛ APK غير الموقّع لا يصلح كتحديث مباشر.

## نشر تحديث Android
- مستودع التنزيلات العام المستخدم هو `dzfastlink-cloud/wasslatv-downloads`.
- بعد زيادة `versionName` و`versionCode` في `app/build.gradle.kts`، ادفع وسمًا مطابقًا بصيغة `app-v<versionName>`، مثل `app-v16.0.0`.
- تحديث القنوات عن بُعد متوقف مؤقتًا حتى تتوفر روابط بث عامة ومصرّح بها؛ لا تنشر ملفات تحتوي بيانات دخول ضمن روابط البث.

## ملاحظات
- التحقق من التحديث يقرأ `android-update.json` من مستودع التنزيلات، مع الرجوع إلى `https://wasslatv.blogspot.com/p/version.html` عند تعذّر ذلك.
- ملفات القنوات الخارجية: حد أقصى 20 م.ب، وتُقرأ من التنزيلات/المستندات/ذاكرة USB/المجلد الذي يختاره المستخدم فقط.

## إضافة حساب Xtream من ملف txt
يقبل التطبيق ملف `.txt` فيه بيانات الحساب، من «إضافة مصدر ← من ملف على الجهاز»، أو بالسحب والإفلات، أو بالبحث التلقائي إن كان اسم الملف يحوي `xtream` أو `server` أو `account` أو `iptv` أو `سيرفر` أو `حساب`. الصيغ المدعومة (وللملف الواحد عدة حسابات يفصل بينها سطر فارغ):

```
host=http://domain.com:8080
username=USER
password=PASS
name=اسم اختياري
```
أو رابط `get.php?username=U&password=P`، أو ثلاثة أسطر (السيرفر ثم المستخدم ثم كلمة السر)، أو سطر واحد `http://domain.com:8080 | USER | PASS`. ملفات M3U العادية تعمل كما كانت.
