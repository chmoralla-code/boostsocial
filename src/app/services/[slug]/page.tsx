import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardCheck, HelpCircle, Search, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { createClient } from "@/utils/supabase/server";
import { parseDescription } from "@/utils/serviceHelpers";
import { getServiceLandingPage, SERVICE_LANDING_PAGES, type ServiceLandingPage } from "@/lib/serviceLandingPages";

type ServiceRow = {
  id: string;
  title: string;
  description: unknown;
  starting_price: number;
  icon_type?: string | null;
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SERVICE_LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getServiceLandingPage(slug);

  if (!page) {
    return {
      title: "Service Not Found | PinoyBoosting",
    };
  }

  return {
    title: `${page.title} | PinoyBoosting`,
    description: page.description,
    alternates: {
      canonical: `https://pinoyboosting.com/services/${page.slug}`,
    },
    openGraph: {
      title: `${page.title} | PinoyBoosting`,
      description: page.description,
      url: `https://pinoyboosting.com/services/${page.slug}`,
      type: "website",
    },
  };
}

async function getServices() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("services")
      .select("id,title,description,starting_price,icon_type")
      .order("created_at", { ascending: true });

    return Array.isArray(data) ? data as ServiceRow[] : [];
  } catch (error) {
    console.error("Failed to load service landing services:", error);
    return [];
  }
}

function serviceText(service: ServiceRow) {
  const parsed = parseDescription(service.description);
  return [
    service.title,
    service.icon_type,
    parsed?.description,
    parsed?.subtitle,
    parsed?.smm_original_name,
  ].filter(Boolean).join(" ").toLowerCase();
}

function getMatchingServices(page: ServiceLandingPage, services: ServiceRow[]) {
  return services
    .map((service) => {
      const text = serviceText(service);
      const score = page.keywords.reduce((total, keyword) => total + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0);
      return { service, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.service.starting_price || 0) - Number(b.service.starting_price || 0))
    .slice(0, 4)
    .map((item) => item.service);
}

function getPrimaryHref(page: ServiceLandingPage, matches: ServiceRow[]) {
  if (page.slug === "facebook-page-setup") return page.primaryHref;
  if (page.slug === "pisowifi-package" && matches[0]) return `/?service_id=${encodeURIComponent(matches[0].id)}`;
  return page.primaryHref;
}

function priceLabel(service: ServiceRow) {
  const amount = Number(service.starting_price || 0);
  const single = service.title.toLowerCase().includes("page")
    || service.title.toLowerCase().includes("pisowifi")
    || service.title.toLowerCase().includes("software")
    || service.title.toLowerCase().includes("license")
    || service.title.toLowerCase().includes("gemini");

  return single ? `Starts at PHP ${amount.toFixed(2)}` : `Starts at PHP ${(amount * 1000).toFixed(2)} / 1k`;
}

export default async function ServiceLandingPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = getServiceLandingPage(slug);
  if (!page) notFound();

  const services = await getServices();
  const matches = getMatchingServices(page, services);
  const primaryHref = getPrimaryHref(page, matches);

  return (
    <>
      <Header />
      <main className="min-h-screen overflow-hidden bg-bg text-white">
        <section className="relative px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="absolute inset-0 -z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:46px_46px]" />
          <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <Link href="/services" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[#1DB954]">
                Services
                <ArrowRight size={14} />
              </Link>
              <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">{page.title}</h1>
              <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-slate-350 sm:text-base">{page.description}</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={primaryHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1DB954] px-6 py-3 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-[#1DB954]/15">
                  Order this service
                  <ArrowRight size={16} />
                </Link>
                <Link href={`/?smm_search=${encodeURIComponent(page.searchQuery)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-800 bg-[#141414] px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Search catalog
                  <Search size={16} />
                </Link>
                <Link href="/track" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-800 bg-[#141414] px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-200">
                  Track order
                  <ClipboardCheck size={16} />
                </Link>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-slate-850 bg-[#121212]/95 p-5 shadow-2xl shadow-black/30 lg:col-span-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1DB954]">{page.category}</p>
              <h2 className="mt-3 text-xl font-black">What clients need</h2>
              <div className="mt-5 space-y-3">
                {page.requirements.map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-slate-850 bg-black/30 p-3">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#1DB954]" />
                    <span className="text-xs font-semibold leading-5 text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-850 bg-[#121212] p-5">
              <ShieldCheck className="text-[#1DB954]" size={26} />
              <h2 className="mt-4 text-lg font-black">Checkout trust flow</h2>
              <ol className="mt-4 space-y-3 text-xs font-semibold leading-6 text-slate-400">
                <li><strong className="text-white">1. Choose service</strong> from this page or the live catalog.</li>
                <li><strong className="text-white">2. Add details</strong> such as target link, page info, or setup notes.</li>
                <li><strong className="text-white">3. Pay GCash or wallet</strong> and keep the Tracking ID.</li>
                <li><strong className="text-white">4. Track order</strong> until admin verification and delivery finish.</li>
              </ol>
            </div>

            <div className="rounded-3xl border border-slate-850 bg-[#121212] p-5 lg:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1DB954]">Best matches</p>
              <h2 className="mt-3 text-lg font-black">Direct checkout links</h2>
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {matches.length > 0 ? matches.map((service) => (
                  <Link key={service.id} href={`/?service_id=${encodeURIComponent(service.id)}`} className="rounded-2xl border border-slate-850 bg-black/30 p-4 transition hover:border-[#1DB954]/40">
                    <span className="block text-sm font-black text-white">{service.title}</span>
                    <span className="mt-2 block text-[11px] font-black uppercase tracking-wider text-[#1DB954]">{priceLabel(service)}</span>
                    <span className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Open checkout
                      <ArrowRight size={13} />
                    </span>
                  </Link>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 p-5 text-xs font-semibold leading-6 text-slate-400 md:col-span-2">
                    Live catalog services are loading from the database. Use the Search catalog button above to open the current filtered catalog.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-850 bg-[#121212] p-5">
                <h2 className="text-lg font-black">What this service includes</h2>
                <div className="mt-5 space-y-3">
                  {page.highlights.map((item) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#1DB954]" />
                      <p className="text-xs font-semibold leading-6 text-slate-350">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-850 bg-[#121212] p-5">
                <h2 className="text-lg font-black">FAQ</h2>
                <div className="mt-5 space-y-3">
                  {page.faqs.map((faq) => (
                    <details key={faq.question} className="group rounded-2xl border border-slate-850 bg-black/25 p-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black text-white">
                        {faq.question}
                        <HelpCircle size={15} className="shrink-0 text-[#1DB954]" />
                      </summary>
                      <p className="mt-3 text-xs font-semibold leading-6 text-slate-400">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
