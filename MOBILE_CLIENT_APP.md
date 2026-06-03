# PinoyBoosting Client Mobile App

This repo includes Capacitor shells for the simplified PinoyBoosting client app.

## How It Updates

The mobile shells open `https://pinoyboosting.com/app` inside the app. That route is a lightweight, beginner-friendly service screen that avoids the full website hero video, floating widgets, and animation-heavy effects.

The **Update** button refreshes the service worker and clears cached web assets before reloading the current page. Native shell changes still require a newly built APK/AAB for Android or IPA/TestFlight build for iOS.

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

The public download copy is served as:

```text
public/downloads/pinoyboosting.apk
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
