"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Bot,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Home,
  KeyRound,
  ListFilter,
  Moon,
  RefreshCw,
  Search,
  ShoppingBag,
  Sun,
  Wallet,
  Wifi,
} from "lucide-react";
import { refreshClientAppContent } from "@/components/ClientAppUpdateButton";
import { parseDescription } from "@/utils/serviceHelpers";
import {
  MOBILE_APP_LOCAL_VERSION_KEY,
  MobileAppSettings,
} from "@/lib/mobileApp";

type AppService = {
  id: string;
  title: string;
  description: unknown;
  starting_price: number;
  icon_type: string;
};

type Shortcut = {
  id: string;
  title: string;
  description: string;
  helper: string;
  kind: "catalog" | "service";
  query?: string;
  matchTerms?: string[];
  tone: string;
  Icon: typeof ShoppingBag;
};

const OrderModal = dynamic(
  () => import("@/components/OrderModal").then((module) => module.OrderModal),
  { ssr: false }
);

const SmmCatalogModal = dynamic(
  () => import("@/components/SmmCatalogModal").then((module) => module.SmmCatalogModal),
  { ssr: false }
);

const SHORTCUTS: Shortcut[] = [
  {
    id: "facebook",
    title: "Facebook Boosts",
    description: "Followers, reactions, likes, and page growth.",
    helper: "Start here for FB pages",
    kind: "catalog",
    query: "Facebook Followers",
    tone: "bg-blue-50 text-blue-700 border-blue-100",
    Icon: ShoppingBag,
  },
  {
    id: "tiktok",
    title: "TikTok Views",
    description: "Views, followers, likes, and video reach.",
    helper: "For videos and creators",
    kind: "catalog",
    query: "TikTok Views",
    tone: "bg-zinc-100 text-zinc-800 border-zinc-200",
    Icon: ListFilter,
  },
  {
    id: "pisowifi",
    title: "PisoWiFi Package",
    description: "Portal setup and WiFi business packages.",
    helper: "For vendo owners",
    kind: "service",
    matchTerms: ["pisowifi", "piso wifi", "wifi vendo"],
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Icon: Wifi,
  },
  {
    id: "gemini",
    title: "Gemini Pro",
    description: "Premium AI subscription assistance.",
    helper: "For AI tools",
    kind: "service",
    matchTerms: ["gemini"],
    tone: "bg-sky-50 text-sky-700 border-sky-100",
    Icon: Bot,
  },
  {
    id: "software",
    title: "Software License",
    description: "AutoCAD, SketchUp, Lumion, and design tools.",
    helper: "For laptop or PC",
    kind: "service",
    matchTerms: ["software", "autocad", "sketchup", "lumion", "revit", "license"],
    tone: "bg-amber-50 text-amber-700 border-amber-100",
    Icon: KeyRound,
  },
];

const ESSENTIAL_TERMS = [
  "pisowifi",
  "piso wifi",
  "wifi vendo",
  "gemini",
  "software",
  "autocad",
  "sketchup",
  "lumion",
  "revit",
  "eap",
  "tp-link",
  "tplink",
  "order page",
];

function serviceText(service: AppService) {
  const parsed = parseDescription(service.description);

  return [
    service.title,
    service.icon_type,
    parsed?.description,
    parsed?.subtitle,
    parsed?.button_text,
    parsed?.smm_original_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function serviceSummary(service: AppService) {
  const parsed = parseDescription(service.description);
  return parsed?.subtitle || parsed?.description || "Tap order and submit your details.";
}

function priceLabel(price: number) {
  const amount = Number(price || 0);
  return amount > 0 ? `Starts at PHP ${amount.toFixed(2)}` : "Price varies";
}

function uniqueServices(services: AppService[]) {
  const seen = new Set<string>();
  return services.filter((service) => {
    if (seen.has(service.id)) return false;
    seen.add(service.id);
    return true;
  });
}

export function ClientAppHome({
  services,
  appSettings,
}: {
  services: AppService[];
  appSettings: MobileAppSettings;
}) {
  const [query, setQuery] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedService, setSelectedService] = useState<AppService | null>(null);
  const [theme, setTheme] = useState(appSettings.defaultTheme);
  const [localVersion, setLocalVersion] = useState(appSettings.appVersion);
  const isDark = theme === "dark";
  const latestVersion = appSettings.latestVersion || appSettings.appVersion;
  const updateAvailable = appSettings.updateAvailable && localVersion !== latestVersion;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem("pinoyboosting:app-theme");
      const savedVersion = window.localStorage.getItem(MOBILE_APP_LOCAL_VERSION_KEY);

      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }

      if (savedVersion) {
        setLocalVersion(savedVersion);
      } else {
        window.localStorage.setItem(MOBILE_APP_LOCAL_VERSION_KEY, appSettings.appVersion);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [appSettings.appVersion]);

  const featuredServices = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (q) {
      return uniqueServices(services)
        .filter((service) => serviceText(service).includes(q))
        .slice(0, 10);
    }

    const essentials = uniqueServices(services)
      .filter((service) => ESSENTIAL_TERMS.some((term) => serviceText(service).includes(term)))
      .slice(0, 8);

    return essentials;
  }, [query, services]);

  const findMatchingService = (terms: string[] = []) => {
    const normalizedTerms = terms.map((term) => term.toLowerCase());
    return services.find((service) => {
      const text = serviceText(service);
      return normalizedTerms.some((term) => text.includes(term));
    });
  };

  const openCatalog = (search: string) => {
    setCatalogSearch(search);
    setCatalogOpen(true);
  };

  const openOrder = (service: AppService) => {
    setSelectedService(service);
  };

  const openShortcut = (shortcut: Shortcut) => {
    if (shortcut.kind === "catalog") {
      openCatalog(shortcut.query || shortcut.title);
      return;
    }

    const matched = findMatchingService(shortcut.matchTerms);
    if (matched) {
      openOrder(matched);
      return;
    }

    openCatalog(shortcut.title);
  };

  const handleUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      await refreshClientAppContent();
      window.localStorage.setItem(MOBILE_APP_LOCAL_VERSION_KEY, latestVersion);
    } finally {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("app_update", String(Date.now()));
      window.location.replace(nextUrl.toString());
    }
  };

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("pinoyboosting:app-theme", nextTheme);
  };

  return (
    <main className={`min-h-screen ${isDark ? "bg-[#101112] text-zinc-100" : "bg-[#f7f8f5] text-[#191919]"}`}>
      <header className={`sticky top-0 z-40 border-b px-4 py-3 ${
        isDark ? "border-zinc-800 bg-[#101112]" : "border-zinc-200 bg-[#f7f8f5]"
      }`}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className={`text-base font-black leading-none ${isDark ? "text-white" : "text-[#111]"}`}>
              {appSettings.appName}
            </p>
            <p className={`mt-1 text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {appSettings.appSubtitle} - v{localVersion}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm ${
                isDark ? "border-zinc-800 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-white text-zinc-800"
              }`}
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              type="button"
              onClick={updateAvailable ? handleUpdate : undefined}
              disabled={isUpdating || !updateAvailable}
              className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-xs font-bold shadow-sm ${
                updateAvailable
                  ? "border-emerald-200 bg-emerald-600 text-white"
                  : isDark
                    ? "border-zinc-800 bg-zinc-900 text-zinc-400"
                    : "border-zinc-200 bg-white text-zinc-500"
              } disabled:cursor-default disabled:opacity-80`}
            >
              <RefreshCw size={15} className={isUpdating ? "animate-spin" : ""} />
              {isUpdating ? "Updating" : updateAvailable ? `Update ${latestVersion}` : "Up to date"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5">
        <section className={`rounded-3xl border p-5 shadow-sm ${
          isDark ? "border-zinc-800 bg-[#171819]" : "border-zinc-200 bg-white"
        }`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
              isDark ? "bg-zinc-900 text-emerald-400" : "bg-emerald-50 text-emerald-700"
            }`}>
              Version {localVersion}
            </span>
            {updateAvailable && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-700">
                New {latestVersion}
              </span>
            )}
          </div>
          <h1 className={`text-2xl font-black leading-tight ${isDark ? "text-white" : "text-zinc-950"}`}>
            {appSettings.heroTitle}
          </h1>
          <p className={`mt-2 text-sm font-medium leading-6 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            {appSettings.heroDescription}
          </p>
          {updateAvailable && (
            <p className={`mt-3 rounded-2xl px-4 py-3 text-xs font-bold leading-5 ${
              isDark ? "bg-amber-500/10 text-amber-200" : "bg-amber-50 text-amber-700"
            }`}>
              {appSettings.updateMessage}
            </p>
          )}

          <label className={`mt-5 flex h-12 items-center gap-3 rounded-2xl border px-4 ${
            isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"
          }`}>
            <Search size={18} className={isDark ? "text-zinc-500" : "text-zinc-400"} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search services"
              className={`h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-400 ${
                isDark ? "text-zinc-100" : "text-zinc-900"
              }`}
            />
          </label>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className={`text-sm font-black ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Most used</h2>
            <button
              type="button"
              onClick={() => openCatalog("")}
              className="text-xs font-bold text-emerald-700"
            >
              All catalog
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SHORTCUTS.map((shortcut) => {
              const Icon = shortcut.Icon;

              return (
                <button
                  key={shortcut.id}
                  type="button"
                  onClick={() => openShortcut(shortcut)}
                  className={`flex min-h-28 items-start gap-3 rounded-3xl border p-4 text-left shadow-sm transition active:scale-[0.99] ${
                    isDark ? "border-zinc-800 bg-[#171819]" : "border-zinc-200 bg-white"
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${shortcut.tone}`}>
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-black ${isDark ? "text-zinc-100" : "text-zinc-950"}`}>{shortcut.title}</span>
                    <span className={`mt-1 block text-xs font-medium leading-5 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                      {shortcut.description}
                    </span>
                    <span className="mt-2 block text-[11px] font-bold text-zinc-400">
                      {shortcut.helper}
                    </span>
                  </span>
                  <ChevronRight size={17} className="mt-1 shrink-0 text-zinc-300" />
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className={`text-sm font-black ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
              {query ? "Search results" : "Other important services"}
            </h2>
            {featuredServices.length > 0 && (
              <span className="text-xs font-bold text-zinc-400">{featuredServices.length} shown</span>
            )}
          </div>

          <div className={`overflow-hidden rounded-3xl border shadow-sm ${
            isDark ? "border-zinc-800 bg-[#171819]" : "border-zinc-200 bg-white"
          }`}>
            {featuredServices.length > 0 ? (
              featuredServices.map((service, index) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => openOrder(service)}
                  className={`flex w-full items-center gap-3 px-4 py-4 text-left transition ${
                    isDark ? "active:bg-zinc-900" : "active:bg-zinc-50"
                  } ${
                    index > 0 ? (isDark ? "border-t border-zinc-800" : "border-t border-zinc-100") : ""
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    isDark ? "bg-zinc-900 text-zinc-300" : "bg-zinc-100 text-zinc-700"
                  }`}>
                    <ShoppingBag size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-black ${isDark ? "text-zinc-100" : "text-zinc-950"}`}>{service.title}</span>
                    <span className={`mt-1 block line-clamp-2 text-xs font-medium leading-5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {serviceSummary(service)}
                    </span>
                    <span className="mt-2 block text-xs font-bold text-emerald-700">
                      {priceLabel(service.starting_price)}
                    </span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-zinc-300" />
                </button>
              ))
            ) : (
              <div className={`p-5 text-sm font-medium leading-6 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                No exact service found. Open the full catalog and search the same keyword.
                <button
                  type="button"
                  onClick={() => openCatalog(query)}
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm font-bold text-white"
                >
                  Open catalog
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <nav className={`fixed inset-x-0 bottom-0 z-40 border-t px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 ${
        isDark ? "border-zinc-800 bg-[#151617]" : "border-zinc-200 bg-white"
      }`}>
        <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1">
          <Link href="/app" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-emerald-700">
            <Home size={18} />
            Services
          </Link>
          <Link href="/track" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <ClipboardList size={18} />
            Orders
          </Link>
          <Link href="/login" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <Wallet size={18} />
            Wallet
          </Link>
          <Link href="/quick-start" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <HelpCircle size={18} />
            Help
          </Link>
        </div>
      </nav>

      <OrderModal
        isOpen={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
        serviceId={selectedService?.id || null}
        serviceTitle={selectedService?.title || ""}
        serviceBasePrice={selectedService?.starting_price || 0}
        service={selectedService}
      />

      <SmmCatalogModal
        isOpen={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        prefilledSearch={catalogSearch}
      />
    </main>
  );
}
