import { MobileAppSettingsPanel } from "./MobileAppSettingsPanel";

export default function AdminMobileAppPage() {
  return (
    <div className="space-y-6 text-slate-300">
      <div className="border-b border-slate-850/60 pb-5">
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          Mobile App Dashboard
        </h1>
        <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-slate-400">
          Edit the simplified APK experience, publish update notices, and control version status separately from the website homepage.
        </p>
      </div>

      <MobileAppSettingsPanel />
    </div>
  );
}
