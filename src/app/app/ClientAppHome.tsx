"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  ClipboardList,
  Home,
  Loader2,
  Lock,
  LogIn,
  Moon,
  RefreshCw,
  Search,
  Send,
  Sun,
  UserPlus,
  Wallet,
  Wifi,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { refreshClientAppContent } from "@/components/ClientAppUpdateButton";
import { parseDescription } from "@/utils/serviceHelpers";
import { createClient } from "@/utils/supabase/client";
import {
  MOBILE_APP_LOCAL_VERSION_KEY,
  MobileAppSettings,
} from "@/lib/mobileApp";
import type { ServiceCandidate } from "@/lib/serviceCandidates";

type AppService = {
  id: string;
  title: string;
  description: unknown;
  starting_price: number;
  icon_type: string;
};

type SmmService = {
  id: string;
  name: string;
  category: string;
  originalRate: number;
  ratePer1k: number;
  startingPrice: number;
  min: number;
  max: number;
  desc: string;
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

type PlatformType = "facebook" | "instagram" | "tiktok" | "youtube";
type ServiceGroup = "utilities" | "pisowifi";

type PendingAppAction =
  | { type: "candidate"; id: string }
  | { type: "catalog"; search: string }
  | { type: "service"; id: string };

type NavigatorConnection = {
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

type ReactionVariantConfig = {
  label: string;
  search: string;
  keywords: string[];
  exclude?: string[];
};

type ReactionVariant = ReactionVariantConfig & {
  item: SmmService | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const PENDING_APP_ACTION_KEY = "pinoyboosting:pending-app-action";
const APP_CACHE_KEY = "pinoyboosting:cached-app-services";

const OrderModal = dynamic(
  () => import("@/components/OrderModal").then((module) => module.OrderModal),
  { ssr: false }
);

const SmmCatalogModal = dynamic(
  () => import("@/components/SmmCatalogModal").then((module) => module.SmmCatalogModal),
  { ssr: false }
);

const SIMPLE_ICON = "https://cdn.simpleicons.org";

const SERVICE_LOGOS: LogoDefinition[] = [
  { match: /\bfacebook\b|\bfb\b/i, src: `${SIMPLE_ICON}/facebook/1877F2`, alt: "Facebook logo", fallback: "f", lightBg: "#eef5ff", darkBg: "#10233f", border: "#bfdcff" },
  { match: /\binstagram\b|\big\b/i, src: `${SIMPLE_ICON}/instagram/E4405F`, alt: "Instagram logo", fallback: "IG", lightBg: "#fff0f6", darkBg: "#351424", border: "#ffc2d8" },
  { match: /\btiktok\b/i, src: `${SIMPLE_ICON}/tiktok/000000`, alt: "TikTok logo", fallback: "TT", lightBg: "#ffffff", darkBg: "#ffffff", border: "#d4d4d8" },
  { match: /\byoutube\b|\byt\b/i, src: `${SIMPLE_ICON}/youtube/FF0000`, alt: "YouTube logo", fallback: "YT", lightBg: "#fff1f2", darkBg: "#3d1111", border: "#fecaca" },
  { match: /\btelegram\b/i, src: `${SIMPLE_ICON}/telegram/26A5E4`, alt: "Telegram logo", fallback: "TG", lightBg: "#eff9ff", darkBg: "#102a3a", border: "#bae6fd" },
  { match: /\bthreads\b/i, src: `${SIMPLE_ICON}/threads/000000`, alt: "Threads logo", fallback: "TH", lightBg: "#ffffff", darkBg: "#ffffff", border: "#d4d4d8" },
  { match: /\btwitch\b/i, src: `${SIMPLE_ICON}/twitch/9146FF`, alt: "Twitch logo", fallback: "TW", lightBg: "#f5f0ff", darkBg: "#21123d", border: "#ddd6fe" },
  { match: /\bspotify\b/i, src: `${SIMPLE_ICON}/spotify/1DB954`, alt: "Spotify logo", fallback: "SP", lightBg: "#ecfdf3", darkBg: "#102918", border: "#bbf7d0" },
  { match: /\bdiscord\b/i, src: `${SIMPLE_ICON}/discord/5865F2`, alt: "Discord logo", fallback: "DC", lightBg: "#eef2ff", darkBg: "#151b3b", border: "#c7d2fe" },
  { match: /\bpinterest\b/i, src: `${SIMPLE_ICON}/pinterest/BD081C`, alt: "Pinterest logo", fallback: "P", lightBg: "#fff1f2", darkBg: "#3b1118", border: "#fecdd3" },
  { match: /\breddit\b/i, src: `${SIMPLE_ICON}/reddit/FF4500`, alt: "Reddit logo", fallback: "RD", lightBg: "#fff4ed", darkBg: "#351807", border: "#fed7aa" },
  { match: /\bwhatsapp\b/i, src: `${SIMPLE_ICON}/whatsapp/25D366`, alt: "WhatsApp logo", fallback: "WA", lightBg: "#ecfdf3", darkBg: "#102819", border: "#bbf7d0" },
  { match: /\bviber\b/i, src: `${SIMPLE_ICON}/viber/7360F2`, alt: "Viber logo", fallback: "VB", lightBg: "#f4f1ff", darkBg: "#20173d", border: "#ddd6fe" },
  { match: /\bsnapchat\b/i, src: `${SIMPLE_ICON}/snapchat/000000`, alt: "Snapchat logo", fallback: "SC", lightBg: "#fffc00", darkBg: "#fffc00", border: "#fef08a" },
  { match: /\btwitter\b|\bx followers\b|\bx likes\b/i, src: `${SIMPLE_ICON}/x/000000`, alt: "X logo", fallback: "X", lightBg: "#ffffff", darkBg: "#ffffff", border: "#d4d4d8" },
  { match: /\bmeta\b/i, src: `${SIMPLE_ICON}/meta/0467DF`, alt: "Meta logo", fallback: "M", lightBg: "#eef5ff", darkBg: "#10243f", border: "#bfdbfe" },
  { match: /\bgemini\b/i, src: `${SIMPLE_ICON}/googlegemini/8E75B2`, alt: "Google Gemini logo", fallback: "G", lightBg: "#f5f3ff", darkBg: "#21183a", border: "#ddd6fe" },
  { match: /\bgoogle\b/i, src: `${SIMPLE_ICON}/google/4285F4`, alt: "Google logo", fallback: "G", lightBg: "#eef5ff", darkBg: "#10243f", border: "#bfdbfe" },
  { match: /\bsketchup\b/i, src: `${SIMPLE_ICON}/sketchup/005F9E`, alt: "SketchUp logo", fallback: "SU", lightBg: "#eef7ff", darkBg: "#102434", border: "#bae6fd" },
  { match: /\brevit\b/i, src: `${SIMPLE_ICON}/autodeskrevit/186BFF`, alt: "Autodesk Revit logo", fallback: "RV", lightBg: "#eef6ff", darkBg: "#11243d", border: "#bfdbfe" },
  { match: /\bautocad\b|\bautodesk\b|\bsoftware\b|\blicense\b/i, src: `${SIMPLE_ICON}/autocad/E51050`, alt: "AutoCAD logo", fallback: "AC", lightBg: "#fff1f2", darkBg: "#3b1218", border: "#fecdd3" },
  { match: /\btp-link\b|\btplink\b|\beap\b/i, src: `${SIMPLE_ICON}/tplink/4ACBD6`, alt: "TP-Link logo", fallback: "TP", lightBg: "#ecfeff", darkBg: "#0e2b30", border: "#a5f3fc" },
  { match: /\bpisowifi\b|\bpiso wifi\b|\bwifi vendo\b|\brouter\b/i, alt: "PisoWiFi service", fallback: "WiFi", lightBg: "#ecfdf5", darkBg: "#10271d", border: "#bbf7d0" },
];

const PLATFORM_REACTION_VARIANTS: Record<PlatformType, ReactionVariantConfig[]> = {
  facebook: [
    { label: "Like", search: "facebook post like", keywords: ["post like", "photo like", "like"], exclude: ["page like", "follower", "view", "share"] },
    { label: "Love / Heart", search: "facebook love reaction", keywords: ["love", "heart"], exclude: ["follower", "view", "share"] },
    { label: "Care", search: "facebook care reaction", keywords: ["care"], exclude: ["follower", "view", "share"] },
    { label: "Haha", search: "facebook haha reaction", keywords: ["haha"], exclude: ["follower", "view", "share"] },
    { label: "Wow", search: "facebook wow reaction", keywords: ["wow"], exclude: ["follower", "view", "share"] },
    { label: "Sad", search: "facebook sad reaction", keywords: ["sad"], exclude: ["follower", "view", "share"] },
    { label: "Angry", search: "facebook angry reaction", keywords: ["angry"], exclude: ["follower", "view", "share"] },
  ],
  instagram: [
    { label: "Post Likes", search: "instagram post likes", keywords: ["post like", "photo like", "like"], exclude: ["follower", "view", "comment"] },
    { label: "Reel Likes", search: "instagram reel likes", keywords: ["reel like", "reels like", "video like"], exclude: ["follower", "view"] },
    { label: "Story Likes", search: "instagram story likes", keywords: ["story like"], exclude: ["follower", "view"] },
    { label: "Saves", search: "instagram saves", keywords: ["save", "saves"], exclude: ["follower", "view"] },
    { label: "Shares", search: "instagram shares", keywords: ["share", "shares"], exclude: ["follower", "view"] },
  ],
  tiktok: [
    { label: "Video Hearts", search: "tiktok hearts", keywords: ["heart", "hearts", "like", "likes"], exclude: ["follower", "view", "comment"] },
    { label: "Live Likes", search: "tiktok live likes", keywords: ["live like", "live likes"], exclude: ["follower", "view"] },
    { label: "Favorites", search: "tiktok favorites", keywords: ["favorite", "favorites", "save", "saves"], exclude: ["follower", "view"] },
    { label: "Shares", search: "tiktok shares", keywords: ["share", "shares"], exclude: ["follower", "view"] },
    { label: "Comments", search: "tiktok comments", keywords: ["comment", "comments"], exclude: ["follower", "view"] },
  ],
  youtube: [
    { label: "Video Likes", search: "youtube video likes", keywords: ["video like", "like", "likes"], exclude: ["subscriber", "view", "comment"] },
    { label: "Shorts Likes", search: "youtube shorts likes", keywords: ["shorts like", "short like"], exclude: ["subscriber", "view"] },
    { label: "Comment Likes", search: "youtube comment likes", keywords: ["comment like", "comment likes"], exclude: ["subscriber", "view"] },
    { label: "Live Likes", search: "youtube live likes", keywords: ["live like", "stream like"], exclude: ["subscriber", "view"] },
  ],
};

const PLATFORM_LABELS: Record<PlatformType, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function serviceText(service: AppService) {
  const parsed = parseDescription(service.description);
  return [
    service.title,
    service.icon_type,
    parsed?.description,
    parsed?.subtitle,
    parsed?.button_text,
    parsed?.smm_original_name,
  ].filter(Boolean).join(" ").toLowerCase();
}

function candidateText(candidate: ServiceCandidate) {
  return [
    candidate.id,
    candidate.tag,
    candidate.title,
    candidate.caption,
    candidate.description,
    candidate.rate_prefix,
    candidate.rate_text,
  ].filter(Boolean).join(" ").toLowerCase();
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

function isUtilityService(service: AppService) {
  const text = serviceText(service);
  return ["gemini", "eap", "tp-link", "tplink", "architectural", "software", "license", "autocad", "sketchup", "lumion", "revit"].some((term) => text.includes(term));
}

function isPisoWifiService(service: AppService) {
  const text = serviceText(service);
  return text.includes("pisowifi") || text.includes("piso wifi") || text.includes("wifi vendo");
}

function isSingleQuantityService(service: AppService) {
  const text = serviceText(service);
  return ["page", "gemini", "pisowifi", "piso wifi", "eap", "tplink", "software", "architectural", "license", "autonomous", "bot"].some((term) => text.includes(term));
}

function isPlatformCandidate(id: string): id is PlatformType {
  return id === "facebook" || id === "instagram" || id === "tiktok" || id === "youtube";
}

function getCandidateActionLabel(candidate: ServiceCandidate) {
  if (candidate.id === "order-page") return "Order Page";
  if (candidate.id === "pisowifi-package") return "View Packages";
  if (candidate.id === "catalog") return "Open Catalog";
  return "View";
}

function ServiceLogo({
  service,
  candidate,
  logoText = "",
  isDark,
  size = "md",
}: {
  service?: AppService;
  candidate?: ServiceCandidate;
  logoText?: string;
  isDark: boolean;
  size?: "sm" | "md";
}) {
  const searchableText = service
    ? `${serviceText(service)} ${logoText}`
    : candidate
      ? `${candidateText(candidate)} ${logoText}`
      : logoText.toLowerCase();
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
          {logo?.fallback || candidate?.emoji || "PB"}
        </span>
      )}
    </span>
  );
}

function linkifyMessageLine(line: string) {
  const parts = line.split(/(https?:\/\/[^\s)]+|\/app(?:\/[^\s),.]*)?(?:\?[^\s),.]*)?|\/track(?:\?[^\s),.]*)?|\/order-page(?:\?[^\s),.]*)?)/g);

  return parts.map((part, index) => {
    const isLink = part.startsWith("http") || part.startsWith("/app") || part.startsWith("/track") || part.startsWith("/order-page");
    if (!isLink) return <span key={`${part}-${index}`}>{part}</span>;
    const appHref = part.startsWith("/track") ? "/app/orders" : part.startsWith("/order-page") ? "/app" : part;

    return (
      <Link key={`${part}-${index}`} href={appHref} className="font-black underline underline-offset-2">
        {appHref}
      </Link>
    );
  });
}

function messageParagraphs(content: string) {
  return content.split("\n").filter(Boolean).map((line, index) => (
    <p key={`${line}-${index}`} className="leading-5">
      {linkifyMessageLine(line)}
    </p>
  ));
}

function AppAiAssistant({
  isOpen,
  onClose,
  isDark,
}: {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! I am the PinoyBoosting realtime AI. Ask for live prices, best services, GCash help, or send a Tracking ID like BS-D5D1D849.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/app-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages.slice(-8) }),
      });
      const data = await res.json();
      const content = data.content || "I could not reach the cloud AI right now. Try again in a moment.";
      setMessages((previous) => [...previous, { role: "assistant", content }]);
    } catch {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: "Connection issue. Please try again, or open Services and choose a package directly." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] backdrop-blur-sm sm:items-center sm:justify-center">
      <section className={`mx-auto flex h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] border shadow-2xl ${
        isDark ? "border-zinc-800 bg-[#151617] text-zinc-100" : "border-zinc-200 bg-white text-zinc-950"
      }`}>
        <div className={`flex items-center justify-between border-b px-4 py-3 ${
          isDark ? "border-zinc-800" : "border-zinc-100"
        }`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <Bot size={20} />
            </span>
            <div>
              <p className="text-sm font-black">Pollinations Realtime AI</p>
              <p className={`text-[11px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                Live services, wallet help, and order status
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-500" aria-label="Close AI chat">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm font-medium ${
                message.role === "user"
                  ? "bg-emerald-600 text-white"
                  : isDark
                    ? "bg-zinc-900 text-zinc-200"
                    : "bg-zinc-100 text-zinc-700"
              }`}>
                {messageParagraphs(message.content)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${
                isDark ? "bg-zinc-900 text-zinc-300" : "bg-zinc-100 text-zinc-600"
              }`}>
                <Loader2 size={14} className="animate-spin" />
                Thinking
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
          className={`border-t p-3 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}
        >
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {[
              "Recommend best Facebook service and send link",
              "How to buy PisoWiFi package",
              "What service is cheapest today",
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void sendMessage(prompt)}
                disabled={loading}
                className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-black ${
                  isDark ? "border-zinc-800 bg-zinc-900 text-zinc-200" : "border-zinc-200 bg-zinc-50 text-zinc-700"
                } disabled:opacity-50`}
              >
                {prompt.replace(" and send link", "")}
              </button>
            ))}
            <Link href="/app/orders" className="shrink-0 rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-black text-white">
              Track orders
            </Link>
          </div>
          <div className={`flex items-center gap-2 rounded-2xl border px-3 ${
            isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"
          }`}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask AI or paste Tracking ID"
              className={`h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-400 ${
                isDark ? "text-zinc-100" : "text-zinc-900"
              }`}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white disabled:opacity-40"
              aria-label="Send AI message"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function ClientAppHome({
  services,
  appSettings,
  serviceCandidates,
}: {
  services: AppService[];
  appSettings: MobileAppSettings;
  serviceCandidates: ServiceCandidate[];
}) {
  const [query, setQuery] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedService, setSelectedService] = useState<AppService | null>(null);
  const [detailsService, setDetailsService] = useState<AppService | null>(null);
  const [presetQuantity, setPresetQuantity] = useState(1000);
  const [theme, setTheme] = useState(appSettings.defaultTheme);
  const [localVersion, setLocalVersion] = useState(appSettings.appVersion);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [serviceGroup, setServiceGroup] = useState<ServiceGroup | null>(null);
  const [platformModal, setPlatformModal] = useState<PlatformType | null>(null);
  const [smmServices, setSmmServices] = useState<SmmService[]>([]);
  const [loadingSmm, setLoadingSmm] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
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

  useEffect(() => {
    const updateNetworkState = () => {
      const connection = (navigator as Navigator & { connection?: NavigatorConnection }).connection;
      const effectiveType = connection?.effectiveType || "";
      setIsOffline(!navigator.onLine);
      setIsSlowConnection(navigator.onLine && (effectiveType === "slow-2g" || effectiveType === "2g"));
    };

    updateNetworkState();
    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);
    (navigator as Navigator & { connection?: NavigatorConnection }).connection?.addEventListener?.("change", updateNetworkState);

    return () => {
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
      (navigator as Navigator & { connection?: NavigatorConnection }).connection?.removeEventListener?.("change", updateNetworkState);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(APP_CACHE_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        services: services.slice(0, 60).map((service) => ({
          id: service.id,
          title: service.title,
          price: service.starting_price,
        })),
        candidates: serviceCandidates.map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          rate: candidate.rate_text,
        })),
      }));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [services, serviceCandidates]);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user || null);
      setAuthReady(true);
    }).catch(() => {
      if (!alive) return;
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAuthReady(true);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoadingSmm(true);
      fetch("/api/smm/services")
        .then((res) => res.ok ? res.json() : [])
        .then((data) => {
          if (Array.isArray(data)) setSmmServices(data);
        })
        .catch(() => undefined)
        .finally(() => setLoadingSmm(false));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const candidateCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return serviceCandidates;
    return serviceCandidates.filter((candidate) => candidateText(candidate).includes(q));
  }, [query, serviceCandidates]);

  const searchedServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return uniqueServices(services)
      .filter((service) => serviceText(service).includes(q))
      .slice(0, 8);
  }, [query, services]);

  const utilityServices = useMemo(() => services.filter(isUtilityService), [services]);
  const pisoWifiServices = useMemo(() => services.filter(isPisoWifiService), [services]);

  const openServiceDetails = useCallback((service: AppService) => {
    setPresetQuantity(isSingleQuantityService(service) ? 1 : 1000);
    setDetailsService(service);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const serviceId = new URLSearchParams(window.location.search).get("service");
      if (!serviceId) return;

      const service = services.find((item) => item.id === serviceId);
      if (!service) return;

      openServiceDetails(service);
      window.history.replaceState(null, "", "/app");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [openServiceDetails, services]);

  const requireLogin = (action: () => void, pendingAction?: PendingAppAction) => {
    if (authReady && user) {
      action();
      return;
    }

    if (pendingAction) {
      window.localStorage.setItem(PENDING_APP_ACTION_KEY, JSON.stringify(pendingAction));
    }

    setAuthPrompt(true);
  };

  const openCatalog = (search: string) => {
    requireLogin(() => {
      setCatalogSearch(search);
      setCatalogOpen(true);
    }, { type: "catalog", search });
  };

  const openOrder = (service: AppService) => {
    requireLogin(() => openServiceDetails(service), { type: "service", id: service.id });
  };

  const orderSmm = (search: string) => {
    setPlatformModal(null);
    setCatalogSearch(search);
    setCatalogOpen(true);
  };

  const runCandidateAction = (candidate: ServiceCandidate) => {
    if (isPlatformCandidate(candidate.id)) {
      const platform = candidate.id;
      requireLogin(() => setPlatformModal(platform), { type: "candidate", id: candidate.id });
      return;
    }

    if (candidate.id === "order-page") {
      requireLogin(() => openCatalog("custom facebook page"), { type: "candidate", id: candidate.id });
      return;
    }

    if (candidate.id === "pisowifi-package") {
      requireLogin(() => setServiceGroup("pisowifi"), { type: "candidate", id: candidate.id });
      return;
    }

    if (candidate.id === "other") {
      requireLogin(() => setServiceGroup("utilities"), { type: "candidate", id: candidate.id });
      return;
    }

    openCatalog(candidate.title);
  };

  useEffect(() => {
    if (!authReady || !user) return;

    const timeout = window.setTimeout(() => {
      const rawAction = window.localStorage.getItem(PENDING_APP_ACTION_KEY);
      if (!rawAction) return;

      window.localStorage.removeItem(PENDING_APP_ACTION_KEY);

      try {
        const pendingAction = JSON.parse(rawAction) as PendingAppAction;

        if (pendingAction.type === "catalog") {
          setCatalogSearch(pendingAction.search);
          setCatalogOpen(true);
          return;
        }

        if (pendingAction.type === "service") {
          const service = services.find((item) => item.id === pendingAction.id);
          if (service) openServiceDetails(service);
          return;
        }

        const candidate = serviceCandidates.find((item) => item.id === pendingAction.id);
        if (!candidate) return;

        if (isPlatformCandidate(candidate.id)) {
          setPlatformModal(candidate.id);
          return;
        }

        if (candidate.id === "order-page") {
          setCatalogSearch("custom facebook page");
          setCatalogOpen(true);
          return;
        }

        if (candidate.id === "pisowifi-package") {
          setServiceGroup("pisowifi");
          return;
        }

        if (candidate.id === "other") {
          setServiceGroup("utilities");
          return;
        }

        setCatalogSearch(candidate.title);
        setCatalogOpen(true);
      } catch {
        window.localStorage.removeItem(PENDING_APP_ACTION_KEY);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [authReady, openServiceDetails, serviceCandidates, services, user]);

  const getPlatformSmmCandidates = (platform: PlatformType) => {
    const reactionFallbacks: ReactionVariant[] = PLATFORM_REACTION_VARIANTS[platform].map((variant) => ({ ...variant, item: null }));

    if (!smmServices.length) {
      return { follower: null, like: null, view: null, reactions: reactionFallbacks };
    }

    let targetFollowerSmmId: string | null = null;
    let targetLikeSmmId: string | null = null;
    let targetViewSmmId: string | null = null;

    services.forEach((service) => {
      const titleLower = service.title.toLowerCase();
      const parsed = parseDescription(service.description);
      const smmId = parsed?.smm_service_id ? String(parsed.smm_service_id) : null;
      if (!smmId) return;

      const matchesPlatform = platform === "facebook"
        ? titleLower.includes("fb") || titleLower.includes("facebook")
        : platform === "instagram"
          ? titleLower.includes("ig") || titleLower.includes("instagram")
          : platform === "youtube"
            ? titleLower.includes("yt") || titleLower.includes("youtube")
            : titleLower.includes("tiktok");

      if (!matchesPlatform) return;
      if (titleLower.includes("follower") || titleLower.includes("subscriber") || titleLower.includes("sub")) targetFollowerSmmId = smmId;
      if (titleLower.includes("reaction") || titleLower.includes("like") || titleLower.includes("heart")) targetLikeSmmId = smmId;
      if (titleLower.includes("view")) targetViewSmmId = smmId;
    });

    const platformServices = smmServices.filter((service) => {
      const category = service.category.toLowerCase();
      const name = service.name.toLowerCase();
      if (platform === "facebook") return category.includes("facebook") || category.includes("fb") || name.includes("facebook") || name.includes("fb");
      if (platform === "youtube") return category.includes("youtube") || category.includes("yt") || name.includes("youtube") || name.includes("yt");
      if (platform === "instagram") return category.includes("instagram") || category.includes("ig") || name.includes("instagram") || name.includes("ig");
      return category.includes(platform) || name.includes(platform);
    });

    if (!platformServices.length) {
      return { follower: null, like: null, view: null, reactions: reactionFallbacks };
    }

    const findCheapestMatching = (keywords: string[], excludeKeywords: string[] = [], usedIds: Set<string> = new Set()) => {
      const matches = platformServices.filter((service) => {
        const nameLower = service.name.toLowerCase();
        const matchesKeywords = keywords.some((keyword) => nameLower.includes(keyword));
        const matchesExclude = excludeKeywords.some((keyword) => nameLower.includes(keyword));
        return matchesKeywords && !matchesExclude && !usedIds.has(String(service.id));
      });
      if (!matches.length) return null;
      return matches.sort((a, b) => a.startingPrice - b.startingPrice)[0];
    };

    const byIdOrFallback = (configuredId: string | null, keywords: string[], exclude: string[] = []) => {
      if (configuredId) {
        const found = smmServices.find((service) => String(service.id) === String(configuredId));
        if (found) return found;
      }
      return findCheapestMatching(keywords, exclude);
    };

    const follower = platform === "youtube"
      ? byIdOrFallback(targetFollowerSmmId, ["subscriber", "subscribers", "sub"])
      : byIdOrFallback(targetFollowerSmmId, ["follower", "profile", "page follower", "classic page"]) || platformServices[0];
    const like = platform === "facebook"
      ? byIdOrFallback(targetLikeSmmId, ["like", "reaction", "react", "photo like", "post like", "love", "haha", "wow", "sad", "angry"], ["follower", "view", "share"])
      : byIdOrFallback(targetLikeSmmId, ["like", "heart"], ["follower", "view", "comment"]);
    const view = byIdOrFallback(targetViewSmmId, ["view", "play", "video", "watch", "reach"], ["follower", "like", "reaction"]) || platformServices[Math.min(2, platformServices.length - 1)];

    const usedReactionIds = new Set<string>();
    const reactions = PLATFORM_REACTION_VARIANTS[platform].map((variant) => {
      const item = findCheapestMatching(variant.keywords, variant.exclude || [], usedReactionIds);
      if (item) usedReactionIds.add(String(item.id));
      return { ...variant, item };
    });

    return {
      follower,
      like: like || platformServices[Math.min(1, platformServices.length - 1)],
      view,
      reactions,
    };
  };

  const handleHome = () => {
    setSelectedService(null);
    setDetailsService(null);
    setCatalogOpen(false);
    setCatalogSearch("");
    setServiceGroup(null);
    setPlatformModal(null);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (window.location.pathname !== "/app" || window.location.search || window.location.hash) {
      window.history.replaceState(null, "", "/app");
    }
  };

  const handleBack = () => {
    if (selectedService) return setSelectedService(null);
    if (detailsService) return setDetailsService(null);
    if (catalogOpen) return setCatalogOpen(false);
    if (serviceGroup) return setServiceGroup(null);
    if (platformModal) return setPlatformModal(null);
    if (aiOpen) return setAiOpen(false);
    if (query.trim()) return setQuery("");
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

  const currentGroupServices = serviceGroup === "pisowifi" ? pisoWifiServices : utilityServices;
  const currentPlatformCandidates = platformModal ? getPlatformSmmCandidates(platformModal) : null;

  return (
    <main className={`min-h-screen ${isDark ? "bg-[#101112] text-zinc-100" : "bg-[#f7f8f5] text-[#191919]"}`}>
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />

      <header className={`sticky top-0 z-40 border-b px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] ${
        isDark ? "border-zinc-800 bg-[#101112]" : "border-zinc-200 bg-[#f7f8f5]"
      }`}>
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={handleBack} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-white text-zinc-800"}`} aria-label="Go back" title="Back">
              <ArrowLeft size={16} />
            </button>
            <button type="button" onClick={handleHome} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm ${isDark ? "border-zinc-800 bg-zinc-900 text-emerald-300" : "border-zinc-200 bg-white text-emerald-700"}`} aria-label="Go home" title="Home">
              <Home size={16} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-base font-black leading-none ${isDark ? "text-white" : "text-[#111]"}`}>{appSettings.appName}</p>
            <p className={`mt-1 truncate text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{appSettings.appSubtitle} - v{localVersion}</p>
          </div>
          <div className="flex shrink-0 items-start gap-2 pt-1">
            <button type="button" onClick={toggleTheme} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-white text-zinc-800"}`} aria-label="Toggle dark mode">
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button type="button" onClick={updateAvailable ? handleUpdate : undefined} disabled={isUpdating || !updateAvailable} className={`relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 text-[11px] font-bold shadow-sm ${updateAvailable ? "border-emerald-200 bg-emerald-600 text-white" : isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400" : "border-zinc-200 bg-white text-zinc-500"} disabled:cursor-default disabled:opacity-80`}>
              {updateAvailable && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-zinc-950">1</span>}
              <RefreshCw size={14} className={isUpdating ? "animate-spin" : ""} />
              {isUpdating ? "Updating" : updateAvailable ? `Update ${latestVersion}` : "Up to date"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5">
        <section className={`rounded-3xl border p-5 shadow-sm ${isDark ? "border-zinc-800 bg-[#171819]" : "border-zinc-200 bg-white"}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${isDark ? "bg-zinc-900 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}>Version {localVersion}</span>
            {updateAvailable && <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-700">New {latestVersion}</span>}
          </div>
          <h1 className={`text-2xl font-black leading-tight ${isDark ? "text-white" : "text-zinc-950"}`}>{appSettings.heroTitle}</h1>
          <p className={`mt-2 text-sm font-medium leading-6 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{appSettings.heroDescription}</p>

          {(isOffline || isSlowConnection) && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-bold leading-5 ${
              isOffline
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : isDark
                  ? "border-zinc-800 bg-zinc-900 text-zinc-300"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600"
            }`}>
              {isOffline ? "You are offline. Previously loaded services stay visible, but checkout needs internet." : "Slow connection detected. The app is keeping effects light while services load."}
            </div>
          )}

          {appSettings.appBanner && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-bold leading-5 ${
              isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-emerald-100 bg-emerald-50 text-emerald-800"
            }`}>
              {appSettings.appBanner}
            </div>
          )}

          {updateAvailable && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 ${
              isDark ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-900"
            }`}>
              <p className="text-xs font-black uppercase tracking-wider">Update ready</p>
              <p className="mt-1 text-xs font-bold leading-5">{appSettings.updateMessage}</p>
              {appSettings.updateHistory && (
                <p className={`mt-2 text-[11px] font-semibold leading-5 ${isDark ? "text-amber-100/75" : "text-amber-800/80"}`}>
                  {appSettings.updateHistory}
                </p>
              )}
            </div>
          )}

          {!user && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/app/auth?mode=login&return=1" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white">
                <LogIn size={16} />
                Login
              </Link>
              <Link href="/app/auth?mode=register&return=1" className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border text-sm font-black ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-zinc-50 text-zinc-800"}`}>
                <UserPlus size={16} />
                Register
              </Link>
            </div>
          )}

          <label className={`mt-5 flex h-12 items-center gap-3 rounded-2xl border px-4 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}>
            <Search size={18} className={isDark ? "text-zinc-500" : "text-zinc-400"} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services" className={`h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-zinc-400 ${isDark ? "text-zinc-100" : "text-zinc-900"}`} />
          </label>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className={`text-sm font-black uppercase tracking-wider ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>SERVICES</h2>
            <button type="button" onClick={() => openCatalog("")} className="text-xs font-bold text-emerald-700">All catalog</button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {candidateCards.map((candidate) => {
              const candidateImageUrl = candidate.image_url?.trim();
              return (
                <button key={candidate.id} type="button" onClick={() => runCandidateAction(candidate)} className={`flex min-h-36 items-start gap-3 rounded-3xl border p-4 text-left shadow-sm transition active:scale-[0.99] ${isDark ? "border-zinc-800 bg-[#171819]" : "border-zinc-200 bg-white"}`}>
                  {candidateImageUrl ? (
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={candidateImageUrl} alt={`${candidate.title} service`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    </span>
                  ) : (
                    <ServiceLogo candidate={candidate} isDark={isDark} size="md" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider" style={{ color: candidate.theme_color || "#1877F2" }}>{candidate.tag}</span>
                    <span className={`block text-sm font-black ${isDark ? "text-zinc-100" : "text-zinc-950"}`}>{candidate.title}</span>
                    {candidate.caption && <span className="mt-1 block text-[11px] font-black uppercase tracking-wider text-zinc-400">{candidate.caption}</span>}
                    <span className={`mt-1 block line-clamp-3 text-xs font-medium leading-5 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{candidate.description}</span>
                    <span className="mt-3 block text-[11px] font-black uppercase tracking-wider text-emerald-700">{candidate.rate_prefix || "Rate"}</span>
                    <span className="block line-clamp-2 text-xs font-bold text-zinc-500">{candidate.rate_text || "Tap to view"}</span>
                    <span className="mt-3 inline-flex h-8 max-w-full items-center gap-1 rounded-full bg-emerald-50 px-2 text-[10px] font-black uppercase text-emerald-700">
                      <span className="truncate">{getCandidateActionLabel(candidate)}</span>
                      <ChevronRight size={13} className="shrink-0" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {query && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className={`text-sm font-black ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Search results</h2>
              <span className="text-xs font-bold text-zinc-400">{searchedServices.length} shown</span>
            </div>
            <div className={`overflow-hidden rounded-3xl border shadow-sm ${isDark ? "border-zinc-800 bg-[#171819]" : "border-zinc-200 bg-white"}`}>
              {searchedServices.length > 0 ? searchedServices.map((service, index) => (
                <button key={service.id} type="button" onClick={() => openOrder(service)} className={`flex w-full items-center gap-3 px-4 py-4 text-left transition ${isDark ? "active:bg-zinc-900" : "active:bg-zinc-50"} ${index > 0 ? (isDark ? "border-t border-zinc-800" : "border-t border-zinc-100") : ""}`}>
                  <ServiceLogo service={service} isDark={isDark} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-black ${isDark ? "text-zinc-100" : "text-zinc-950"}`}>{service.title}</span>
                    <span className={`mt-1 block line-clamp-2 text-xs font-medium leading-5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{serviceSummary(service)}</span>
                    <span className="mt-2 block text-xs font-bold text-emerald-700">{priceLabel(service.starting_price)}</span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-zinc-300" />
                </button>
              )) : (
                <div className={`p-5 text-sm font-medium leading-6 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  No exact service found. Open the full catalog and search the same keyword.
                  <button type="button" onClick={() => openCatalog(query)} className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm font-bold text-white">Open catalog</button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <nav className={`fixed inset-x-0 bottom-0 z-40 border-t px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 ${isDark ? "border-zinc-800 bg-[#151617]" : "border-zinc-200 bg-white"}`}>
        <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1">
          <Link href="/app" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-emerald-700">
            <Home size={18} />
            Services
          </Link>
          <Link href="/app/orders" className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <ClipboardList size={18} />
            Orders
          </Link>
          <Link href={user ? "/app/profile" : "/app/auth?mode=login&return=1"} className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <Wallet size={18} />
            Wallet
          </Link>
          <button type="button" onClick={() => setAiOpen(true)} className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold text-zinc-500">
            <Bot size={18} />
            AI
          </button>
        </div>
      </nav>

      {authPrompt && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] backdrop-blur-sm sm:items-center sm:justify-center">
          <section className={`mx-auto w-full max-w-sm rounded-[1.75rem] border p-5 shadow-2xl ${isDark ? "border-zinc-800 bg-[#151617] text-zinc-100" : "border-zinc-200 bg-white text-zinc-950"}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <Lock size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-black">Login required</h3>
                <p className={`mt-1 text-sm font-medium leading-6 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  Clients must login or register before buying any service in the app.
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link href="/app/auth?mode=login&return=1" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white">
                <LogIn size={16} />
                Login
              </Link>
              <Link href="/app/auth?mode=register&return=1" className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border text-sm font-black ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-zinc-50 text-zinc-800"}`}>
                <UserPlus size={16} />
                Register
              </Link>
            </div>
            <button type="button" onClick={() => setAuthPrompt(false)} className="mt-3 h-11 w-full rounded-2xl text-sm font-black text-zinc-500">
              Not now
            </button>
          </section>
        </div>
      )}

      {serviceGroup && (
        <div className="fixed inset-0 z-[88] flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] backdrop-blur-sm sm:items-center sm:justify-center">
          <section className={`mx-auto max-h-[82vh] w-full max-w-md overflow-hidden rounded-[1.75rem] border shadow-2xl ${isDark ? "border-zinc-800 bg-[#151617] text-zinc-100" : "border-zinc-200 bg-white text-zinc-950"}`}>
            <div className={`flex items-center justify-between border-b px-4 py-4 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
              <div>
                <h3 className="text-lg font-black">{serviceGroup === "pisowifi" ? "PisoWiFi Packages" : "Specialty Services"}</h3>
                <p className={`text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Same checkout flow, app-friendly picker.</p>
              </div>
              <button type="button" onClick={() => setServiceGroup(null)} className="rounded-full p-2 text-zinc-500" aria-label="Close services">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[68vh] space-y-3 overflow-y-auto p-4">
              {currentGroupServices.length > 0 ? currentGroupServices.map((service) => (
                <button key={service.id} type="button" onClick={() => {
                  setServiceGroup(null);
                  openOrder(service);
                }} className={`flex w-full items-center gap-3 rounded-3xl border p-4 text-left ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}>
                  <ServiceLogo service={service} isDark={isDark} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{service.title}</span>
                    <span className={`mt-1 block line-clamp-2 text-xs leading-5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{serviceSummary(service)}</span>
                    <span className="mt-2 block text-xs font-bold text-emerald-700">{priceLabel(service.starting_price)}</span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-zinc-300" />
                </button>
              )) : (
                <div className={`rounded-3xl border border-dashed p-5 text-sm font-semibold ${isDark ? "border-zinc-800 text-zinc-400" : "border-zinc-200 text-zinc-500"}`}>
                  No active service is available in this group yet.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {platformModal && currentPlatformCandidates && (
        <div className="fixed inset-0 z-[88] flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] backdrop-blur-sm sm:items-center sm:justify-center">
          <section className={`mx-auto max-h-[86vh] w-full max-w-md overflow-hidden rounded-[1.75rem] border shadow-2xl ${isDark ? "border-zinc-800 bg-[#151617] text-zinc-100" : "border-zinc-200 bg-white text-zinc-950"}`}>
            <div className={`flex items-center justify-between border-b px-4 py-4 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
              <div className="flex items-center gap-3">
                <ServiceLogo logoText={platformModal} isDark={isDark} size="sm" />
                <div>
                  <h3 className="text-lg font-black">{PLATFORM_LABELS[platformModal]} Services</h3>
                  <p className={`text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Cheapest packs and reaction variants.</p>
                </div>
              </div>
              <button type="button" onClick={() => setPlatformModal(null)} className="rounded-full p-2 text-zinc-500" aria-label="Close platform services">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-4">
              {loadingSmm ? (
                <div className="flex items-center justify-center gap-2 rounded-3xl p-8 text-sm font-bold text-zinc-500">
                  <Loader2 size={18} className="animate-spin" />
                  Loading live catalog
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { title: "Follower / Subscriber Pack", item: currentPlatformCandidates.follower },
                      { title: "Post Like / Reaction Pack", item: currentPlatformCandidates.like },
                      { title: "Direct Views / Plays Pack", item: currentPlatformCandidates.view },
                    ].map((slot) => slot.item && (
                      <button key={`${slot.title}-${slot.item.id}`} type="button" onClick={() => orderSmm(slot.item!.id)} className={`rounded-3xl border p-4 text-left ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}>
                        <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-700">{slot.title}</span>
                        <span className="mt-1 block text-sm font-black">{slot.item.name}</span>
                        <span className={`mt-1 block line-clamp-2 text-xs leading-5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{slot.item.desc || slot.item.category}</span>
                        <span className="mt-3 block text-xs font-black text-emerald-700">PHP {(slot.item.startingPrice * 1000).toFixed(2)} / 1k - Order Boost</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <h4 className={`mb-2 text-xs font-black uppercase tracking-wider ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>Reaction services inside</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {currentPlatformCandidates.reactions.map((reaction) => (
                        <button key={reaction.label} type="button" onClick={() => orderSmm(reaction.item ? reaction.item.id : `${platformModal} ${reaction.search}`)} className={`min-h-24 rounded-2xl border p-3 text-left ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}>
                          <span className="block text-xs font-black">{reaction.label}</span>
                          <span className={`mt-1 block line-clamp-2 text-[11px] leading-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                            {reaction.item ? reaction.item.name : `Search ${reaction.search}`}
                          </span>
                          <span className="mt-2 block text-[11px] font-black text-emerald-700">
                            {reaction.item ? `PHP ${(reaction.item.startingPrice * 1000).toFixed(2)} / 1k` : "Browse"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="button" onClick={() => orderSmm(platformModal)} className="flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-black text-white">
                    View Other {PLATFORM_LABELS[platformModal]} Services
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {detailsService && (
        <div className="fixed inset-0 z-[89] flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] backdrop-blur-sm sm:items-center sm:justify-center">
          <section className={`mx-auto w-full max-w-md overflow-hidden rounded-[1.75rem] border shadow-2xl ${isDark ? "border-zinc-800 bg-[#151617] text-zinc-100" : "border-zinc-200 bg-white text-zinc-950"}`}>
            <div className={`flex items-center justify-between border-b px-4 py-4 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
              <div className="flex min-w-0 items-center gap-3">
                <ServiceLogo service={detailsService} isDark={isDark} size="sm" />
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-black">{detailsService.title}</h3>
                  <p className={`text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Review service before checkout.</p>
                </div>
              </div>
              <button type="button" onClick={() => setDetailsService(null)} className="rounded-full p-2 text-zinc-500" aria-label="Close service details">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className={`rounded-3xl border p-4 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Starts at</p>
                <p className="mt-1 text-2xl font-black">{priceLabel(detailsService.starting_price)}</p>
                <p className={`mt-3 text-sm font-semibold leading-6 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {serviceSummary(detailsService)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <div className={`rounded-2xl border p-3 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
                  Saved to account
                  <span className="mt-1 block truncate text-[11px] text-emerald-700">{user?.email || "Logged in"}</span>
                </div>
                <div className={`rounded-2xl border p-3 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
                  Track later
                  <span className="mt-1 block text-[11px] text-emerald-700">App Orders</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedService(detailsService);
                  setDetailsService(null);
                }}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-black text-white"
              >
                Continue to checkout
              </button>
            </div>
          </section>
        </div>
      )}

      <AppAiAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} isDark={isDark} />

      <OrderModal
        isOpen={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
        serviceId={selectedService?.id || null}
        serviceTitle={selectedService?.title || ""}
        serviceBasePrice={selectedService?.starting_price || 0}
        presetQuantity={presetQuantity}
        service={selectedService}
      />

      <SmmCatalogModal isOpen={catalogOpen} onClose={() => setCatalogOpen(false)} prefilledSearch={catalogSearch} />
    </main>
  );
}
