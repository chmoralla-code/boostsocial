# PinoyBoosting Admin Android App

This repo includes an Android shell for the admin dashboard.

## How It Updates

The Android shell opens `https://pinoyboosting.com/admin` inside the app. Because the dashboard is loaded from the live website, any dashboard or website changes deployed to Vercel are reflected the next time the Android app opens or refreshes.

## Local Build

```powershell
npm.cmd install
npx.cmd cap sync android
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
Set-Location android
.\gradlew.bat :app:assembleDebug
```

The debug APK is generated at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For a release APK/AAB, create a private signing key and configure Gradle signing locally. Do not commit keystore files or passwords.

## Web Install

The Next.js app also exposes a web app manifest at `/manifest.webmanifest`, so Android users can install the admin dashboard from Chrome as a standalone app.
