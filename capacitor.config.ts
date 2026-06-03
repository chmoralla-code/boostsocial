import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pinoyboosting.app",
  appName: "PinoyBoosting",
  webDir: "android-shell",
  backgroundColor: "#0a0a0a",
  loggingBehavior: "debug",
  appendUserAgent: " PinoyBoostingClientApp",
  server: {
    url: "https://pinoyboosting.com/",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["pinoyboosting.com", "www.pinoyboosting.com"],
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
