import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// الواجهة كلها في assets (HTML/CSS/JS) والغلاف الوحيد هو WebActivity.kt
// (واجهة Compose القديمة أُزيلت من هذا المستودع، ولا يحذف البناء أي ملف)

// بيانات التوقيع: متغيرات البيئة (GitHub Secrets) ثم ملف keystore.properties المحلي (غير مرفوع إلى git)
val ksProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun signing(envName: String, propName: String): String? =
    System.getenv(envName)?.takeIf { it.isNotBlank() } ?: ksProps.getProperty(propName)

val ksFile = signing("WASSLA_KEYSTORE_FILE", "storeFile") ?: "wasslatv.jks"
val ksPass = signing("WASSLA_STORE_PASSWORD", "storePassword")
val ksAlias = signing("WASSLA_KEY_ALIAS", "keyAlias") ?: "wasslatv"
val ksKeyPass = signing("WASSLA_KEY_PASSWORD", "keyPassword") ?: ksPass

android {
    namespace = "dz.wassla.tv"
    compileSdk = 34
    defaultConfig {
        applicationId = "dz.wassla.tv"
        minSdk = 21
        // 29: يسمح بقراءة مجلد التنزيلات وUSB مباشرة للبحث عن ملفات القنوات الجديدة (التطبيق خارج المتجر)
        targetSdk = 29
        versionCode = 24
        versionName = "15.3.0"
    }
    // مفتاح ثابت ليُثبَّت كل إصدار جديد فوق السابق. كلمات المرور لم تعد في الكود.
    signingConfigs {
        create("release") {
            if (ksPass != null && file(ksFile).exists()) {
                storeFile = file(ksFile)
                storePassword = ksPass
                keyAlias = ksAlias
                keyPassword = ksKeyPass
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            val rel = signingConfigs.getByName("release")
            if (rel.storeFile != null) {
                signingConfig = rel
            } else {
                logger.warn("WARNING: لا توجد بيانات توقيع (WASSLA_STORE_PASSWORD أو keystore.properties). سيُبنى APK غير موقّع.")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}
