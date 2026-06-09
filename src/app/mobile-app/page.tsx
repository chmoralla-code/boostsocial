import Link from "next/link";
import { ArrowLeft, Download, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { readMobileAppSettingsFromAnyDatabase } from "@/lib/mobileAppServer";

const apkPath = "/downloads/pinoyboosting.apk";

export const dynamic = "force-dynamic";

export default async function MobileAppDownloadPage() {
  const settings = await readMobileAppSettingsFromAnyDatabase();
  const updateAvailable = settings.updateAvailable && settings.latestVersion !== settings.appVersion;

  return (
    <main className="min-h-screen bg-bg text-white relative overflow-hidden px-5 py-8">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none" />
      <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#1DB954]/15 blur-[90px]" />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col justify-center gap-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={14} />
          Website
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1DB954]/25 bg-[#1DB954]/10 text-[#1DB954] shadow-[0_0_30px_rgba(29,185,84,0.15)]">
              <Smartphone size={28} />
            </div>

            <div className="space-y-3">
              <h1 className="max-w-2xl text-4xl font-black uppercase leading-tight tracking-tight sm:text-5xl">
                PinoyBoosting Mobile App
              </h1>
              <p className="max-w-xl text-sm font-semibold leading-7 text-slate-400">
                Install the Android client app for a simpler PinoyBoosting experience focused on
                services, orders, wallet, tracking, and help.
              </p>
              <div className="inline-flex rounded-full border border-[#1DB954]/20 bg-[#1DB954]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#1DB954]">
                Version {settings.appVersion}
                {updateAvailable ? ` -> ${settings.latestVersion}` : " - up to date"}
              </div>
              <p className="text-xs font-bold text-slate-500">
                APK file: pinoyboosting.apk
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {updateAvailable ? (
                <a
                  href={apkPath}
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1DB954] px-6 py-4 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-emerald-500/10 transition hover:bg-[#1ed760]"
                >
                  <Download size={17} />
                  Download update {settings.latestVersion}
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-default items-center justify-center gap-2 rounded-full border border-slate-800 bg-[#181818]/80 px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-400"
                >
                  <ShieldCheck size={17} />
                  Up to date
                </button>
              )}
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-800 bg-[#181818]/80 px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-[#1DB954]/40 hover:text-white"
              >
                Open Website
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#121212]/90 p-5 shadow-2xl">
            <div className="rounded-xl border border-slate-800 bg-bg p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954] text-sm font-black text-black">
                  P
                </span>
                <span className="rounded-full border border-[#1DB954]/20 bg-[#1DB954]/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[#1DB954]">
                  Android
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <RefreshCw className="mt-0.5 text-[#1DB954]" size={18} />
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-white">
                      Manual Updates
                    </h2>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                      {updateAvailable
                        ? settings.updateMessage
                        : "The current APK build is already marked as the latest app version."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 text-blue-400" size={18} />
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-white">
                      Same Website Security
                    </h2>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                      Orders, login, tracking, receipts, and wallet actions use the existing
                      live PinoyBoosting website and server APIs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
