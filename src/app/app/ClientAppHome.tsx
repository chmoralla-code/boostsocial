"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Home,
  Moon,
  RefreshCw,
  Search,
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
};

type LogoDefinition = {
  match: RegExp;
  src?: string;
  alt: string;
  fallback: string;
  lightBg: string;
  darkBg: string;
  border: string;
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
  },
  {
    id: "tiktok",
    title: "TikTok Views",
    description: "Views, followers, likes, and video reach.",
    helper: "For videos and creators",
    kind: "catalog",
    query: "TikTok Views",
  },
  {
    id: "pisowifi",
    title: "PisoWiFi Package",
    description: "Portal setup and WiFi business packages.",
    helper: "For vendo owners",
    kind: "service",
    matchTerms: ["pisowifi", "piso wifi", "wifi vendo"],
  },
  {
    id: "gemini",
    title: "Gemini Pro",
    description: "Premium AI subscription assistance.",
    helper: "For AI tools",
    kind: "service",
    matchTerms: ["gemini"],
  },
  {
    id: "software",
    title: "Software License",
    description: "AutoCAD, SketchUp, Lumion, and design tools.",
    helper: "For laptop or PC",
    kind: "service",
    matchTerms: ["software", "autocad", "sketchup", "lumion", "revit", "license"],
  },
];

const SIMPLE_ICON = "https://cdn.simpleicons.org";

const SERVICE_LOGOS: LogoDefinition[] = [
  {
    match: /\bfacebook\b|\bfb\b/i,
    src: `${SIMPLE_ICON}/facebook/1877F2`,
    alt: "Facebook logo",
    fallback: "f",
    lightBg: "#eef5ff",
    darkBg: "#10233f",
    border: "#bfdcff",
  },
  {
    match: /\binstagram\b|\big\b/i,
    src: `${SIMPLE_ICON}/instagram/E4405F`,
    alt: "Instagram logo",
    fallback: "IG",
    lightBg: "#fff0f6",
    darkBg: "#351424",
    border: "#ffc2d8",
  },
  {
    match: /\btiktok\b/i,
    src: `${SIMPLE_ICON}/tiktok/000000`,
    alt: "TikTok logo",
    fallback: "TT",
    lightBg: "#ffffff",
    darkBg: "#ffffff",
    border: "#d4d4d8",
  },
  {
    match: /\byoutube\b|\byt\b/i,
    src: `${SIMPLE_ICON}/youtube/FF0000`,
    alt: "YouTube logo",
    fallback: "YT",
    lightBg: "#fff1f2",
    darkBg: "#3d1111",
    border: "#fecaca",
  },
  {
    match: /\btelegram\b/i,
    src: `${SIMPLE_ICON}/telegram/26A5E4`,
    alt: "Telegram logo",
    fallback: "TG",
    lightBg: "#eff9ff",
    darkBg: "#102a3a",
    border: "#bae6fd",
  },
  {
    match: /\bthreads\b/i,
    src: `${SIMPLE_ICON}/threads/000000`,
    alt: "Threads logo",
    fallback: "TH",
    lightBg: "#ffffff",
    darkBg: "#ffffff",
    border: "#d4d4d8",
  },
  {
    match: /\btwitch\b/i,
    src: `${SIMPLE_ICON}/twitch/9146FF`,
    alt: "Twitch logo",
    fallback: "TW",
    lightBg: "#f5f0ff",
    darkBg: "#21123d",
    border: "#ddd6fe",
  },
  {
    match: /\bspotify\b/i,
    src: `${SIMPLE_ICON}/spotify/1DB954`,
    alt: "Spotify logo",
    fallback: "SP",
    lightBg: "#ecfdf3",
    darkBg: "#102918",
    border: "#bbf7d0",
  },
  {
    match: /\bdiscord\b/i,
    src: `${SIMPLE_ICON}/discord/5865F2`,
    alt: "Discord logo",
    fallback: "DC",
    lightBg: "#eef2ff",
    darkBg: "#151b3b",
    border: "#c7d2fe",
  },
  {
    match: /\bpinterest\b/i,
    src: `${SIMPLE_ICON}/pinterest/BD081C`,
    alt: "Pinterest logo",
    fallback: "P",
    lightBg: "#fff1f2",
    darkBg: "#3b1118",
    border: "#fecdd3",
  },
  {
    match: /\breddit\b/i,
    src: `${SIMPLE_ICON}/reddit/FF4500`,
    alt: "Reddit logo",
    fallback: "RD",
    lightBg: "#fff4ed",
    darkBg: "#351807",
    border: "#fed7aa",
  },
  {
    match: /\bwhatsapp\b/i,
    src: `${SIMPLE_ICON}/whatsapp/25D366`,
    alt: "WhatsApp logo",
    fallback: "WA",
    lightBg: "#ecfdf3",
    darkBg: "#102819",
    border: "#bbf7d0",
  },
  {
    match: /\bviber\b/i,
    src: `${SIMPLE_ICON}/viber/7360F2`,
    alt: "Viber logo",
    fallback: "VB",
    lightBg: "#f4f1ff",
    darkBg: "#20173d",
    border: "#ddd6fe",
  },
  {
    match: /\bsnapchat\b/i,
    src: `${SIMPLE_ICON}/snapchat/000000`,
    alt: "Snapchat logo",
    fallback: "SC",
    lightBg: "#fffc00",
    darkBg: "#fffc00",
    border: "#fef08a",
  },
  {
    match: /\btwitter\b|\bx followers\b|\bx likes\b/i,
    src: `${SIMPLE_ICON}/x/000000`,
    alt: "X logo",
    fallback: "X",
    lightBg: "#ffffff",
    darkBg: "#ffffff",
    border: "#d4d4d8",
  },
  {
    match: /\bmeta\b/i,
    src: `${SIMPLE_ICON}/meta/0467DF`,
    alt: "Meta logo",
    fallback: "M",
    lightBg: "#eef5ff",
    darkBg: "#10243f",
    border: "#bfdbfe",
  },
  {
    match: /\bgemini\b/i,
    src: `${SIMPLE_ICON}/googlegemini/8E75B2`,
    alt: "Google Gemini logo",
    fallback: "G",
    lightBg: "#f5f3ff",
    darkBg: "#21183a",
    border: "#ddd6fe",
  },
  {
    match: /\bgoogle\b/i,
    src: `${SIMPLE_ICON}/google/4285F4`,
    alt: "Google logo",
    fallback: "G",
    lightBg: "#eef5ff",
    darkBg: "#10243f",
    border: "#bfdbfe",
  },
  {
    match: /\bsketchup\b/i,
    src: `${SIMPLE_ICON}/sketchup/005F9E`,
    alt: "SketchUp logo",
    fallback: "SU",
    lightBg: "#eef7ff",
    darkBg: "#102434",
    border: "#bae6fd",
  },
  {
    match: /\brevit\b/i,
    src: `${SIMPLE_ICON}/autodeskrevit/186BFF`,
    alt: "Autodesk Revit logo",
    fallback: "RV",
    lightBg: "#eef6ff",
    darkBg: "#11243d",
    border: "#bfdbfe",
  },
  {
    match: /\bautocad\b|\bautodesk\b|\bsoftware\b|\blicense\b/i,
    src: `${SIMPLE_ICON}/autocad/E51050`,
    alt: "AutoCAD logo",
    fallback: "AC",
    lightBg: "#fff1f2",
    darkBg: "#3b1218",
    border: "#fecdd3",
  },
  {
    match: /\btp-link\b|\btplink\b|\beap\b/i,
    src: `${SIMPLE_ICON}/tplink/4ACBD6`,
    alt: "TP-Link logo",
    fallback: "TP",
    lightBg: "#ecfeff",
    darkBg: "#0e2b30",
    border: "#a5f3fc",
  },
  {
    match: /\bpisowifi\b|\bpiso wifi\b|\bwifi vendo\b|\brouter\b/i,
    alt: "PisoWiFi service",
    fallback: "WiFi",
    lightBg: "#ecfdf5",
    darkBg: "#10271d",
    border: "#bbf7d0",
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

function getDirectLogoSrc(value: string) {
  const trimmed = value.trim();
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  return "";
}

function getServiceLogo(text: string) {
  return SERVICE_LOGOS.find((logo) => logo.match.test(text)) || null;
}

function ServiceLogo({
  service,
  logoText = "",
  isDark,
  size = "md",
}: {
  service?: AppService;
  logoText?: string;
  isDark: boolean;
  size?: "sm" | "md";
}) {
  const searchableText = service ? `${serviceText(service)} ${logoText}` : logoText.toLowerCase();
  const logo = getServiceLogo(searchableText);
  const directSrc = service?.icon_type ? getDirectLogoSrc(service.icon_type) : "";
  const src = directSrc || logo?.src || "";
  const [failedSrc, setFailedSrc] = useState("");
  const imageFailed = Boolean(src && failedSrc === src);
  const dimensionClass = size === "sm" ? "h-10 w-10 rounded-2xl" : "h-11 w-11 rounded-2xl";
  const imageClass = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden border ${dimensionClass}`}
      style={{
        backgroundColor: logo ? (isDark ? logo.darkBg : logo.lightBg) : isDark ? "#18181b" : "#f4f4f5",
        borderColor: logo?.border || (isDark ? "#27272a" : "#e4e4e7"),
      }}
    >
      {src && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={directSrc ? `${service?.title || "Service"} logo` : logo?.alt || "Service logo"}
          className={`${imageClass} object-contain`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      ) : logo?.fallback === "WiFi" ? (
        <Wifi size={size === "sm" ? 19 : 21} className={isDark ? "text-emerald-300" : "text-emerald-700"} />
      ) : (
        <span className={`text-[11px] font-black ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
          {logo?.fallback || "PB"}
        </span>
      )}
    </span>
  );
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

  const handleHome = () => {
    setSelectedService(null);
    setCatalogOpen(false);
    setCatalogSearch("");
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (window.location.pathname !== "/app" || window.location.search || window.location.hash) {
      window.history.replaceState(null, "", "/app");
    }
  };

  const handleBack = () => {
    if (selectedService) {
      setSelectedService(null);
      return;
    }

    if (catalogOpen) {
      setCatalogOpen(false);
      setCatalogSearch("");
      return;
    }

    if (query.trim()) {
      setQuery("");
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    handleHome();
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
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleBack}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm ${
                isDark ? "border-zinc-800 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-white text-zinc-800"
              }`}
              aria-label="Go back"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleHome}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm ${
                isDark ? "border-zinc-800 bg-zinc-900 text-emerald-300" : "border-zinc-200 bg-white text-emerald-700"
              }`}
              aria-label="Go home"
              title="Home"
            >
              <Home size={16} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-base font-black leading-none ${isDark ? "text-white" : "text-[#111]"}`}>
              {appSettings.appName}
            </p>
            <p className={`mt-1 truncate text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {appSettings.appSubtitle} - v{localVersion}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm ${
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
              className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 text-[11px] font-bold shadow-sm ${
                updateAvailable
                  ? "border-emerald-200 bg-emerald-600 text-white"
                  : isDark
                    ? "border-zinc-800 bg-zinc-900 text-zinc-400"
                    : "border-zinc-200 bg-white text-zinc-500"
              } disabled:cursor-default disabled:opacity-80`}
            >
              <RefreshCw size={14} className={isUpdating ? "animate-spin" : ""} />
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
              return (
                <button
                  key={shortcut.id}
                  type="button"
                  onClick={() => openShortcut(shortcut)}
                  className={`flex min-h-28 items-start gap-3 rounded-3xl border p-4 text-left shadow-sm transition active:scale-[0.99] ${
                    isDark ? "border-zinc-800 bg-[#171819]" : "border-zinc-200 bg-white"
                  }`}
                >
                  <ServiceLogo logoText={`${shortcut.id} ${shortcut.title}`} isDark={isDark} size="sm" />
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
                  <ServiceLogo service={service} isDark={isDark} size="sm" />
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
