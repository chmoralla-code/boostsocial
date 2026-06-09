import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SERVICE_LANDING_PAGES } from "@/lib/serviceLandingPages";

export const metadata: Metadata = {
  title: "PinoyBoosting Services | Social Media, PisoWiFi, and Page Setup",
  description: "Browse PinoyBoosting service pages for Facebook, Instagram, TikTok, YouTube, PisoWiFi, and custom Facebook page setup.",
  alternates: {
    canonical: "https://pinoyboosting.com/services",
  },
};

export default function ServicesLandingIndexPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-bg px-4 py-14 text-white sm:px-6 lg:px-8">
        <section className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#1DB954]">Service directory</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Choose the exact service page.</h1>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-400 sm:text-base">
              Each page shows what the service is for, what link/details clients need, and the fastest button into the correct checkout or catalog flow.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/#services" className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-5 py-3 text-xs font-black uppercase tracking-wider text-black">
              <Search size={15} />
              Browse all services
            </Link>
            <Link href="/track" className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-[#151515] px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-200">
              Track order
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SERVICE_LANDING_PAGES.map((page) => (
              <Link
                key={page.slug}
                href={`/services/${page.slug}`}
                className="group flex min-h-64 flex-col justify-between rounded-3xl border border-slate-850 bg-[#121212] p-5 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-[#1DB954]/45"
              >
                <span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1DB954]">{page.category}</span>
                  <h2 className="mt-3 text-xl font-black tracking-tight text-white">{page.title}</h2>
                  <p className="mt-3 text-xs font-semibold leading-6 text-slate-400">{page.description}</p>
                </span>
                <span className="mt-5 flex items-center justify-between gap-3 border-t border-slate-850 pt-4">
                  <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-300">
                    <CheckCircle2 size={14} className="text-[#1DB954]" />
                    {page.highlights.length} highlights
                  </span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1DB954] text-black transition group-hover:translate-x-1">
                    <ArrowRight size={16} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
