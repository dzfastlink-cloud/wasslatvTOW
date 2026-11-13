# وصلة TV (WasslaTV)

تطبيق Android TV لمشاهدة القنوات. الواجهة كلها في `app/src/main/assets` (HTML/CSS/JS) والغلاف الأصلي هو `WebActivity.kt`.

## هيكل المشروع
- `app/src/main/assets/channels.json` : قائمة القنوات المعتمدة المدمجة في التطبيق.
- `data/test/` : قوائم تجريبية (غير مدمجة في الـ APK): `builtin_channels.json`، `official_channels.json`.
- `app/src/main/assets/js/lib/` : مكتبات التشغيل (راجع README داخله).

## البناء
- عبر GitHub Actions (`.github/workflows/build.yml`) أو محليًا بـ `gradle assembleRelease` (Gradle 8.9 وJDK 17).
- الـ APK يجب أن يكون موقّعًا بنفس المفتاح دائمًا حتى يُثبَّت كل إصدار فوق السابق.

### بيانات التوقيع (لا تُكتب في الكود)
**على GitHub:** أضف في Settings > Secrets and variables > Actions:
- `WASSLA_STORE_PASSWORD` (مطلوب)، و`WASSLA_KEY_ALIAS` و`WASSLA_KEY_PASSWORD` (اختياريان، الافتراضي alias=`wasslatv` وكلمة مرور المفتاح = كلمة مرور المخزن)
- `WASSLA_KEYSTORE_BASE64` (اختياري): محتوى ملف jks بصيغة base64. إن غاب يُستعمل `app/wasslatv.jks` الموجود في المستودع (فاجعل المستودع **خاصًا Private**).

**محليًا:** انسخ `keystore.properties.example` إلى `keystore.properties` واملأه.

## ملاحظات
- التحقق من التحديث يقرأ `https://wasslatv.blogspot.com/p/version.html` (عناصر `ver` و`dl` و`notes`).
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
