import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pinoyboosting.admin",
  appName: "PinoyBoosting Admin",
  webDir: "android-shell",
  backgroundColor: "#0a0a0a",
  loggingBehavior: "debug",
  server: {
    url: "https://pinoyboosting.com/admin",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: ["pinoyboosting.com", "www.pinoyboosting.com"],
    errorPath: "offline.html",
  },
  android: {
    backgroundColor: "#0a0a0a",
    appendUserAgent: " PinoyBoostingAdminAndroid",
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
