import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock, Sparkles, Rocket } from "lucide-react";
import { HormachuelosNotifyForm } from "./HormachuelosNotifyForm";

export const metadata: Metadata = {
  title: "HORMACHUELOS AI — Coming Soon",
  description:
    "Make your own website & APK easily with just a prompt. Hormachuelos AI is coming soon — be the first to know when it launches.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "HORMACHUELOS AI — Coming Soon",
    description:
      "Make your own website & APK easily with just a prompt. Hormachuelos AI is coming soon.",
    url: "https://pinoyboosting.com/hormachuelos-ai",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "HORMACHUELOS AI" }],
  },
};

export default function HormachuelosAiPage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] px-4 py-10 text-white">
      {/* Ambient glow backdrop */}
      <div className="pointer-events-none absolute -left-[10%] -top-[20%] h-[460px] w-[460px] rounded-full bg-[#8B5CF6]/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-[20%] -right-[10%] h-[460px] w-[460px] rounded-full bg-[#1DB954]/10 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.006)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.006)_1px,transparent_1px)] bg-[size:30px_30px]" />

      {/* Back to home */}
      <Link
        href="/"
        className="absolute left-5 top-5 z-20 inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-[#121212]/80 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 backdrop-blur-md transition hover:border-[#8B5CF6]/40 hover:text-white"
      >
        <ArrowLeft size={13} /> Back to PinoyBoosting
      </Link>

      <div className="relative z-10 w-full max-w-xl text-center">
        {/* Lock badge */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 shadow-[0_0_40px_rgba(139,92,246,0.25)]">
          <Lock size={34} className="text-[#a78bfa]" />
        </div>

        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-[#a78bfa]">
          <Sparkles size={11} /> Coming Soon
        </div>

        <h1 className="text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
          HORMACHUELOS <span className="text-[#a78bfa]">AI</span>
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-relaxed text-slate-300 sm:text-base">
          Make your own website &amp; APK easily with just a prompt.
        </p>

        <p className="mx-auto mt-3 max-w-lg text-xs font-medium leading-relaxed text-slate-500">
          Describe what you want in plain words and Hormachuelos AI builds a full website or
          Android APK for you — no code, no setup. The product is not live yet, so access is
          locked until launch.
        </p>

        {/* Prohibit-entry notice */}
        <div className="mx-auto mt-6 flex max-w-md items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-left">
          <Lock size={15} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="text-[11px] font-semibold leading-relaxed text-amber-200/90">
            Access is currently restricted. This product is in private development and is not
            available for use yet.
          </p>
        </div>

        {/* Notify-me form */}
        <div className="mx-auto mt-8 max-w-md">
          <HormachuelosNotifyForm />
        </div>

        {/* Launch tease */}
        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <Rocket size={12} className="text-[#8B5CF6]" />
          Launching exclusively on PinoyBoosting
        </div>
      </div>
    </main>
  );
}
