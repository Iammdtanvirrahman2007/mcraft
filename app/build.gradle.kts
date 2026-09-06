plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.tanvir.mcraft"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.tanvir.mcraft"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets["main"].assets.srcDir(rootProject.projectDir)
    sourceSets["main"].assets.exclude("app/**")
    sourceSets["main"].assets.exclude(".git/**")
    sourceSets["main"].assets.exclude(".idea/**")
    sourceSets["main"].assets.exclude("build/**")
    sourceSets["main"].assets.exclude("*.gradle.kts")
    sourceSets["main"].assets.exclude("gradle.properties")
}
