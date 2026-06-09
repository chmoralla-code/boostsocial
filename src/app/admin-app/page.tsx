import Link from "next/link";
import { ArrowLeft, Download, ShieldCheck, Smartphone, RefreshCw } from "lucide-react";

const apkPath = "/downloads/pinoyboosting-admin-debug.apk";

export default function AdminAppDownloadPage() {
  return (
    <main className="min-h-screen bg-bg text-white relative overflow-hidden px-5 py-8">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none" />
      <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#1DB954]/15 blur-[90px]" />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col justify-center gap-8">
        <Link
          href="/admin/login"
          className="inline-flex w-fit items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={14} />
          Admin Login
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1DB954]/25 bg-[#1DB954]/10 text-[#1DB954] shadow-[0_0_30px_rgba(29,185,84,0.15)]">
              <Smartphone size={28} />
            </div>

            <div className="space-y-3">
              <h1 className="max-w-2xl text-4xl font-black uppercase leading-tight tracking-tight sm:text-5xl">
                PinoyBoosting Admin Android App
              </h1>
              <p className="max-w-xl text-sm font-semibold leading-7 text-slate-400">
                Install the Android admin shell for direct access to the live PinoyBoosting
                dashboard.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={apkPath}
                download
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1DB954] px-6 py-4 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-emerald-500/10 transition hover:bg-[#1ed760]"
              >
                <Download size={17} />
                Download APK
              </a>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-800 bg-[#181818]/80 px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-[#1DB954]/40 hover:text-white"
              >
                Open Web Admin
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-[#121212]/90 p-5 shadow-2xl">
            <div className="rounded-xl border border-slate-800 bg-bg p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954] text-sm font-black text-black">
                  C
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
                      Live Updates
                    </h2>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                      The app loads the deployed admin dashboard, so Vercel updates appear
                      without rebuilding this APK.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 text-blue-400" size={18} />
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-white">
                      Admin Protected
                    </h2>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                      Access still uses the existing Supabase admin login and
                      @boostsocial.com account check.
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
