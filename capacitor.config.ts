import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pinoyboosting.app",
  appName: "PinoyBoosting",
  webDir: "android-shell",
  backgroundColor: "#0a0a0a",
  loggingBehavior: "none",
  appendUserAgent: " PinoyBoostingClientApp",
  server: {
    url: "https://pinoyboosting.com/app",
    cleartext: false,
    androidScheme: "https",
    // PayMongo's hosted checkout must stay inside the app's WebView. Without
    // these hosts Capacitor treats the checkout page as an external link and
    // hands it to Chrome, where the customer is no longer signed in - so the
    // payment succeeds but the return page shows a logged-out site and the
    // wallet never appears to update.
    allowNavigation: [
      "pinoyboosting.com",
      "www.pinoyboosting.com",
      "paymongo.com",
      "checkout.paymongo.com",
      "*.paymongo.com",
    ],
    errorPath: "offline.html",
  },
  android: {
    backgroundColor: "#0a0a0a",
    appendUserAgent: " PinoyBoostingClientAndroid PinoyBoostingClientApp",
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: "#0a0a0a",
    appendUserAgent: " PinoyBoostingClientIOS PinoyBoostingClientApp",
  },
};

export default config;
