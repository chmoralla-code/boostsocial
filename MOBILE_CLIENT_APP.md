# PinoyBoosting Client Mobile App

This repo includes Capacitor shells for the simplified PinoyBoosting client app.

## How It Updates

The mobile shells open `https://pinoyboosting.com/app` inside the app. That route is a lightweight, beginner-friendly service screen that avoids the full website hero video, floating widgets, and animation-heavy effects.

The **Update** button refreshes the service worker and clears cached web assets before reloading the current page. Native shell changes still require a newly built APK/AAB for Android or IPA/TestFlight build for iOS.

## Release Signing (important)

The Android APK is signed with the release keystore at:

```text
android/pinoyboosting-release.jks   (gitignored - never commit it)
```

Gradle reads the password and alias from:

```text
android/keystore.properties         (gitignored - never commit it)
```

Release certificate fingerprints (keep for reference):

```text
SHA-256: 8B:4C:18:AF:48:B5:20:1F:11:E7:38:03:53:85:BD:12:E6:3B:F8:DF:F2:42:35:31:CD:11:87:6D:E3:16:1B:AA
SHA-1:   89:59:A3:68:01:EB:4F:A0:95:DC:CC:1E:E1:9D:E4:03:3C:14:C2:C0
```

> Back up `android/pinoyboosting-release.jks` and `android/keystore.properties`
> somewhere safe (password manager / private cloud). If this keystore is lost,
> existing installations can never be updated in place again - every client
> would have to uninstall and reinstall.

## Android Build (release)

```powershell
npm.cmd install
npx.cmd cap sync android
$env:ANDROID_HOME="C:\Android-SDK"
$env:ANDROID_SDK_ROOT="C:\Android-SDK"
Set-Location android
.\gradlew.bat :app:assembleRelease
```

The signed release APK is generated at:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Copy it to the public download path served by the website:

```text
public/downloads/pinoyboosting.apk
```

For a Play Store release use `:app:bundleRelease` instead and upload the `.aab`
from `android/app/build/outputs/bundle/release/`.

### Versioning

Bump both values in `android/app/build.gradle` before every release:

```gradle
versionCode 3        // must strictly increase every release
versionName "2.1"    // shown to users
```

Then update the app version shown on the website: Admin dashboard ->
**Mobile App** settings -> set `App version` / `Latest version` and the update
message, or the download page will advertise the wrong version.

### One-time reinstall for early clients

Builds before 2.0 were debug-signed, so Android cannot update them in place.
Clients who installed the old APK must uninstall it once, then install the new
build. After that, all future updates install normally.

## Regenerating icons & splash screens

All launcher icons and splash screens are generated from
`public/icon-512.png` (green rounded square + white "P"):

```powershell
node scripts/build-android-icons.mjs
```

Re-run that after changing the brand artwork, then rebuild.

## Android Build (debug, for local testing only)

```powershell
Set-Location android
.\gradlew.bat :app:assembleDebug
```

Debug APKs are signed with a throwaway local key. **Never distribute debug
APKs to clients** - they cannot be updated in place and Android flags them as
debuggable.

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
