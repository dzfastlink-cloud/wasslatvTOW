plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// الواجهة كلها في assets (HTML/CSS/JS) والغلاف الوحيد هو WebActivity.kt
// (واجهة Compose القديمة أُزيلت من هذا المستودع، ولا يحذف البناء أي ملف)

android {
    namespace = "dz.wassla.tv"
    compileSdk = 34
    defaultConfig {
        applicationId = "dz.wassla.tv"
        minSdk = 21
        // 29: يسمح بقراءة مجلد التنزيلات وUSB مباشرة للبحث عن ملفات القنوات الجديدة (التطبيق خارج المتجر)
        targetSdk = 29
        versionCode = 27
        versionName = "16.0.0"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
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
