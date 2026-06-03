# PinoyBoosting Client Mobile App

This repo includes Capacitor shells for the public PinoyBoosting client website.

## How It Updates

The mobile shells open `https://pinoyboosting.com/` inside the app. Because the app loads the live website, website changes deployed to Vercel are reflected after the app opens or after the customer taps the in-app **Update App** button.

The **Update App** button refreshes the service worker and clears cached web assets before reloading the current page. Native shell changes still require a newly built APK/AAB for Android or IPA/TestFlight build for iOS.

## Android Build

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

## iOS Build

```bash
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

iOS cannot be signed into an IPA on Windows. Open the generated `ios/App/App.xcworkspace` on macOS with Xcode, configure the Apple Team/signing profile, then archive for TestFlight or App Store distribution.

## Web Install

The Next.js app also exposes a web app manifest at `/manifest.webmanifest`, so users can install the public website from supported browsers as a standalone web app.
