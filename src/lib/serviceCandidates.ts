export const SERVICE_CANDIDATES_KEY = "services_candidates";

export type ServiceCandidate = {
  id: string;
  emoji?: string;
  tag?: string;
  title: string;
  caption?: string;
  description: string;
  rate_prefix?: string;
  rate_text?: string;
  theme_color?: string;
  btn_bg?: string;
  glow_color?: string;
  layout?: string;
  image_url?: string;
  video_url?: string;
  smm_service_id?: string;
  coming_soon?: boolean;
  page_href?: string;
};

export const DEFAULT_SERVICE_CANDIDATES: ServiceCandidate[] = [
  {
    id: "facebook",
    emoji: "FB",
    tag: "Facebook Boosts",
    title: "Page & Reaction Menu",
    description: "Scale pages and posts with followers, views, comments, and exact Facebook reactions like Like, Heart/Love, Care, Haha, Wow, Sad, and Angry.",
    rate_prefix: "Starting Rate",
    rate_text: "PHP 25.18 per 1k boosts",
    theme_color: "#1877F2",
    glow_color: "rgba(24, 119, 242, 0.45)",
  },
  {
    id: "instagram",
    emoji: "IG",
    tag: "Instagram Boosts",
    title: "Likes, Reels & Growth",
    description: "Build authority with targeted followers, post likes, reel likes, story likes, saves, shares, views, and profile impressions.",
    rate_prefix: "Starting Rate",
    rate_text: "PHP 24.98 per 1k boosts",
    theme_color: "#E1306C",
    glow_color: "rgba(225, 48, 108, 0.45)",
  },
  {
    id: "tiktok",
    emoji: "TT",
    tag: "TikTok Boosts",
    title: "Hearts, Shares & Views",
    description: "Amplify TikTok videos with followers, video hearts, live likes, favorites, comments, shares, and high-speed views.",
    rate_prefix: "Starting Rate",
    rate_text: "PHP 30.00 per 1k boosts",
    theme_color: "#00F2FE",
    glow_color: "rgba(0, 242, 254, 0.45)",
  },
  {
    id: "youtube",
    emoji: "YT",
    tag: "YouTube Boosts",
    title: "Subscribers & Likes",
    description: "Unlock monetization support with subscribers, watch hours, views, video likes, Shorts likes, comment likes, and live likes.",
    rate_prefix: "Starting Rate",
    rate_text: "PHP 132.21 per 1k boosts",
    theme_color: "#FF0000",
    glow_color: "rgba(255, 0, 0, 0.45)",
  },
  {
    id: "pisowifi-package",
    emoji: "WiFi",
    tag: "PISOWIFI PACKAGE",
    title: "PISOWIFI PACKAGE",
    caption: "Starter, Professional & Enterprise",
    description: "Dedicated PisoWiFi package bundles with the existing GCash QR payment flow, receipt upload, and installation details for manual admin review.",
    rate_prefix: "Package Rates",
    rate_text: "Starter PHP 5,800 | Professional PHP 8,500 | Enterprise PHP 11,000",
    theme_color: "#1877F2",
    glow_color: "rgba(24, 119, 242, 0.45)",
  },
  {
    id: "order-page",
    emoji: "Page",
    tag: "ORDER PAGE",
    title: "Custom Facebook Page",
    caption: "Page setup + FB followers",
    description: "Launch a custom Facebook page with profile and cover assets, FB bio, transfer link, GCash or wallet checkout, and follower quantity priced from SMM #2026.",
    rate_prefix: "Base Package",
    rate_text: "PHP 1,999 includes 10k followers",
    layout: "standard",
    theme_color: "#1877F2",
    glow_color: "rgba(24, 119, 242, 0.45)",
  },
  {
    id: "hormachuelos-ai",
    emoji: "🤖",
    tag: "AI WEBSITE & APK BUILDER",
    title: "HORMACHUELOS AI",
    caption: "Make your own website & APK easily with just a prompt",
    description: "Describe what you want in plain words and Hormachuelos AI builds a full website or Android APK for you — no code, no setup, just a prompt.",
    rate_prefix: "Availability",
    rate_text: "Available now",
    theme_color: "#8B5CF6",
    glow_color: "rgba(139, 92, 246, 0.45)",
    video_url: "/hormachuelos-promo.mp4",
    coming_soon: false,
    page_href: "https://hormachuelos.vercel.app/#/",
  },
  {
    id: "other",
    emoji: "Tools",
    tag: "OTHER SERVICES",
    title: "Specialty & Utilities",
    description: "Premium digital memberships, network router optimizations, and pre-activated professional architectural design tools.",
    rate_prefix: "Included services",
    rate_text: "Gemini Subscriptions, EAP TP-Link routers, and Architectural Software",
    theme_color: "#1877F2",
    glow_color: "rgba(24, 119, 242, 0.45)",
  },
  {
    id: "catalog",
    emoji: "All",
    tag: "ALL SERVICES",
    title: "ALL SERVICES",
    description: "Instantly search and order from 1,100+ premium boosts and custom digital services at direct reseller pricing.",
    rate_prefix: "Direct Reseller Rates",
    rate_text: "Instagram Followers, TikTok Hearts, YouTube Sub Packs, Telegram, Twitter, & more",
    theme_color: "#1DB954",
    glow_color: "rgba(29, 185, 84, 0.45)",
  },
];

const CANDIDATE_ORDER = ["facebook", "instagram", "tiktok", "youtube", "order-page", "hormachuelos-ai", "pisowifi-package", "other", "catalog"];

function candidateRank(candidate: { id?: string }) {
  const rank = CANDIDATE_ORDER.indexOf(candidate.id || "");
  return rank === -1 ? CANDIDATE_ORDER.length : rank;
}

function normalizeCandidate(value: unknown): ServiceCandidate | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ServiceCandidate>;
  if (!item.id || !item.title || !item.description) return null;

  return {
    id: String(item.id),
    emoji: typeof item.emoji === "string" ? item.emoji : "",
    tag: typeof item.tag === "string" ? item.tag : item.title,
    title: String(item.title),
    caption: typeof item.caption === "string" ? item.caption : "",
    description: String(item.description),
    rate_prefix: typeof item.rate_prefix === "string" ? item.rate_prefix : "",
    rate_text: typeof item.rate_text === "string" ? item.rate_text : "",
    theme_color: typeof item.theme_color === "string" && item.theme_color ? item.theme_color : "#1877F2",
    btn_bg: typeof item.btn_bg === "string" ? item.btn_bg : "",
    glow_color: typeof item.glow_color === "string" ? item.glow_color : "",
    layout: typeof item.layout === "string" ? item.layout : "standard",
    image_url: typeof item.image_url === "string" ? item.image_url : "",
    video_url: typeof item.video_url === "string" ? item.video_url : "",
    smm_service_id: item.smm_service_id ? String(item.smm_service_id) : "",
    coming_soon: item.coming_soon === true,
    page_href: typeof item.page_href === "string" ? item.page_href : "",
  };
}

export function mergeServiceCandidates(savedCandidates: unknown) {
  const normalized = Array.isArray(savedCandidates)
    ? savedCandidates.flatMap((item) => {
        const candidate = normalizeCandidate(item);
        return candidate ? [candidate] : [];
      })
    : [];

  const merged = [...normalized];
  for (const fallback of DEFAULT_SERVICE_CANDIDATES) {
    if (!merged.some((item) => item.id === fallback.id)) {
      merged.push(fallback);
    }
  }

  // Backfill media fields (video_url, image_url) from defaults onto saved
  // candidates that are missing them. Older saved configs predate these
  // fields, so without this the pisowifi / hormachuelos promo videos would
  // silently disappear whenever a DB config exists.
  for (const card of merged) {
    const def = DEFAULT_SERVICE_CANDIDATES.find((d) => d.id === card.id);
    if (!def) continue;
    if (!card.video_url && def.video_url) card.video_url = def.video_url;
    if (!card.image_url && def.image_url) card.image_url = def.image_url;
  }

  return merged.sort((a, b) => candidateRank(a) - candidateRank(b));
}
