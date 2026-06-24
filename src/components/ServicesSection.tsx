"use client";

import { useState, useEffect } from "react";
import { ServiceCard } from "./ServiceCard";
import { OrderModal } from "./OrderModal";
import { FaqSection } from "./FaqSection";
import { ReviewsSection } from "./ReviewsSection";
import { SmmCatalogModal } from "./SmmCatalogModal";
import { Layers, X, Loader2, Wifi } from "lucide-react";
import { parseDescription } from "@/utils/serviceHelpers";
import { createClient } from "@/utils/supabase/client";
import { getVipDiscountPercent, isVipActive } from "@/utils/vip";


interface Service {
  id: string;
  title: string;
  description: any;
  starting_price: number;
  icon_type: string;
}

type PlatformType = "facebook" | "instagram" | "tiktok" | "youtube";
type OtherServiceGroup = "utilities" | "pisowifi";

interface SmmService {
  id: string;
  name: string;
  category: string;
  originalRate: number;
  ratePer1k: number;
  startingPrice: number;
  min: number;
  max: number;
  desc: string;
}

interface ReactionVariantConfig {
  label: string;
  icon: string;
  search: string;
  keywords: string[];
  exclude?: string[];
}

interface ReactionVariant extends ReactionVariantConfig {
  item: SmmService | null;
}

interface ServicesSectionProps {
  services: Service[];
  servicesBg?: { videoUrl: string; opacity: number };
  servicesCandidates?: ServiceCandidate[] | null;
}

interface ServiceCandidate {
  id: string;
  emoji: string;
  tag: string;
  title: string;
  description: string;
  rate_prefix: string;
  rate_text: string;
  theme_color: string;
  btn_bg?: string;
  glow_color?: string;
  caption?: string;
  layout?: string;
  image_url?: string;
  logo_url?: string;
  video_url?: string;
  coming_soon?: boolean;
  page_href?: string;
}

/* Real official brand logos (SVG) — keyed by ServiceCandidate.id.
   Inlined as data URIs so the homepage never depends on a 3rd-party CDN. */
const REAL_LOGOS: Record<string, string> = {
  facebook:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#1877F2"/><path fill="#fff" d="M27.5 25.5h3.4l.6-4.1h-4v-2.6c0-1.2.3-2 2-2h2.1v-3.7c-.4 0-1.6-.2-3-.2-3 0-5 1.8-5 5.1v2.9h-3.4v4.1h3.4V38h4.1V25.5z"/></svg>`
    ),
  instagram:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#FDF497"/><stop offset="5%" stop-color="#FDF497"/><stop offset="45%" stop-color="#FD5949"/><stop offset="60%" stop-color="#D6249F"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><rect width="48" height="48" rx="11" fill="url(#ig)"/><path fill="#fff" d="M24 14.5c-5.2 0-9.5 4.3-9.5 9.5s4.3 9.5 9.5 9.5 9.5-4.3 9.5-9.5-4.3-9.5-9.5-9.5zm0 15.7a6.2 6.2 0 1 1 0-12.4 6.2 6.2 0 0 1 0 12.4zM34 12.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z"/></svg>`
    ),
  tiktok:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#000"/><path fill="#25F4EE" d="M31 12.5c.7 2.4 2.4 4.4 4.8 5.2v3.6c-1.9 0-3.7-.5-5.3-1.4v8.7c0 5.2-4.2 9.4-9.4 9.4s-9.4-4.2-9.4-9.4 4.2-9.4 9.4-9.4c.6 0 1.2.1 1.8.2v3.7c-.6-.2-1.2-.3-1.8-.3-3.2 0-5.8 2.6-5.8 5.8s2.6 5.8 5.8 5.8 5.8-2.6 5.8-5.8V12.5H31z"/><path fill="#FE2C55" d="M31.5 13c.7 2.4 2.4 4.4 4.8 5.2v3.6c-1.9 0-3.7-.5-5.3-1.4v8.7c0 5.2-4.2 9.4-9.4 9.4s-9.4-4.2-9.4-9.4 4.2-9.4 9.4-9.4c.6 0 1.2.1 1.8.2v3.7c-.6-.2-1.2-.3-1.8-.3-3.2 0-5.8 2.6-5.8 5.8s2.6 5.8 5.8 5.8 5.8-2.6 5.8-5.8V13h3.6z"/><path fill="#fff" d="M31 12v.5c.7 2.4 2.4 4.4 4.8 5.2v3.6c-1.9 0-3.7-.5-5.3-1.4v8.7c0 5.2-4.2 9.4-9.4 9.4s-9.4-4.2-9.4-9.4 4.2-9.4 9.4-9.4c.6 0 1.2.1 1.8.2v3.7c-.6-.2-1.2-.3-1.8-.3-3.2 0-5.8 2.6-5.8 5.8s2.6 5.8 5.8 5.8 5.8-2.6 5.8-5.8V12H31z"/></svg>`
    ),
  youtube:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#FF0000"/><path fill="#fff" d="M19 15.5l14 8.5-14 8.5V15.5z"/></svg>`
    ),
  "pisowifi-package":
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#10B981"/><path fill="#fff" d="M24 14c-5.5 0-10 4.5-10 10 0 7.4 10 14.5 10 14.5S34 31.4 34 24c0-5.5-4.5-10-10-10zm0 13.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>`
    ),
  "order-page":
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#1877F2"/><path fill="#fff" d="M16 14h11.5a6.5 6.5 0 1 1 0 13H20v7h-4V14zm4 3v7h7.2a3.5 3.5 0 1 0 0-7H20z"/></svg>`
    ),
  other:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#0EA5E9"/><path fill="#fff" d="M12 16h6l4 8 4-8h6v20h-4V22l-4 8h-4l-4-8v14h-4V16zm26 4h4v16h-4V20z"/></svg>`
    ),
  catalog:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#1DB954"/><circle cx="24" cy="24" r="10" fill="none" stroke="#fff" stroke-width="3"/><path fill="#fff" d="M20 18l12 6-12 6V18z"/></svg>`
    )
};

const ORDER_PAGE_CANDIDATE: ServiceCandidate = {
  id: "order-page",
  emoji: "📄",
  tag: "ORDER PAGE",
  title: "Custom Facebook Page",
  caption: "Page setup + FB followers",
  description: "Launch a custom Facebook page with profile and cover assets, FB bio, transfer link, GCash or wallet checkout, and follower quantity priced from SMM #2026.",
  rate_prefix: "Base Package",
  rate_text: "₱1,999 includes 10k followers",
  layout: "standard",
  theme_color: "#1877F2",
  btn_bg: "bg-[#1877F2] hover:bg-[#4e8df5]",
  glow_color: "rgba(24, 119, 242, 0.45)"
};

const HORMACHUELOS_CANDIDATE: ServiceCandidate = {
  id: "hormachuelos-ai",
  emoji: "🤖",
  tag: "AI WEBSITE & APK BUILDER",
  title: "HORMACHUELOS AI",
  caption: "Make your own website & APK easily with just a prompt",
  description: "Describe what you want in plain words and Hormachuelos AI builds a full website or Android APK for you — no code, no setup, just a prompt.",
  rate_prefix: "Availability",
  rate_text: "Coming Soon",
  theme_color: "#8B5CF6",
  btn_bg: "bg-[#8B5CF6] hover:bg-[#a78bfa] text-white",
  glow_color: "rgba(139, 92, 246, 0.45)",
  video_url: "/hormachuelos-promo.mp4",
  coming_soon: true,
  page_href: "/hormachuelos-ai"
};

const PLATFORM_SERVICE_CHIPS: Record<PlatformType, string[]> = {
  facebook: ["FB Followers", "FB Views", "FB Comments", "Like", "Love", "Care", "Haha", "Wow", "Sad", "Angry"],
  instagram: ["IG Followers", "Post Likes", "Reel Likes", "Story Likes", "Saves", "Shares", "Views"],
  tiktok: ["TT Followers", "Hearts", "Live Likes", "Favorites", "Shares", "Comments", "Views"],
  youtube: ["YT Subs", "Watch Hours", "Video Likes", "Shorts Likes", "Comment Likes", "Live Likes"]
};

const PLATFORM_CARD_COPY: Record<PlatformType, { title: string; description: string }> = {
  facebook: {
    title: "Followers & Reactions",
    description: "FB followers, views, comments & 7 exact reactions — Like, Love, Care, Haha, Wow, Sad, Angry."
  },
  instagram: {
    title: "Followers & Likes",
    description: "IG followers, post/reel/story likes, saves, shares, views & profile impressions."
  },
  tiktok: {
    title: "Followers & Hearts",
    description: "TT followers, video hearts, live likes, favorites, comments, shares & high-speed views."
  },
  youtube: {
    title: "Subs & Watch Time",
    description: "YT subscribers, watch hours, video/Shorts likes, comment likes & live likes."
  }
};

const PLATFORM_REACTION_VARIANTS: Record<PlatformType, ReactionVariantConfig[]> = {
  facebook: [
    { label: "Like", icon: "👍", search: "facebook post like", keywords: ["post like", "photo like", "like"], exclude: ["page like", "follower", "view", "share"] },
    { label: "Love / Heart", icon: "❤️", search: "facebook love reaction", keywords: ["love", "heart"], exclude: ["follower", "view", "share"] },
    { label: "Care", icon: "🤗", search: "facebook care reaction", keywords: ["care"], exclude: ["follower", "view", "share"] },
    { label: "Haha", icon: "😆", search: "facebook haha reaction", keywords: ["haha"], exclude: ["follower", "view", "share"] },
    { label: "Wow", icon: "😮", search: "facebook wow reaction", keywords: ["wow"], exclude: ["follower", "view", "share"] },
    { label: "Sad", icon: "😢", search: "facebook sad reaction", keywords: ["sad"], exclude: ["follower", "view", "share"] },
    { label: "Angry", icon: "😡", search: "facebook angry reaction", keywords: ["angry"], exclude: ["follower", "view", "share"] }
  ],
  instagram: [
    { label: "Post Likes", icon: "❤️", search: "instagram post likes", keywords: ["post like", "photo like", "like"], exclude: ["follower", "view", "comment"] },
    { label: "Reel Likes", icon: "🎬", search: "instagram reel likes", keywords: ["reel like", "reels like", "video like"], exclude: ["follower", "view"] },
    { label: "Story Likes", icon: "✨", search: "instagram story likes", keywords: ["story like"], exclude: ["follower", "view"] },
    { label: "Saves", icon: "🔖", search: "instagram saves", keywords: ["save", "saves"], exclude: ["follower", "view"] },
    { label: "Shares", icon: "↗️", search: "instagram shares", keywords: ["share", "shares"], exclude: ["follower", "view"] }
  ],
  tiktok: [
    { label: "Video Hearts", icon: "❤️", search: "tiktok hearts", keywords: ["heart", "hearts", "like", "likes"], exclude: ["follower", "view", "comment"] },
    { label: "Live Likes", icon: "📡", search: "tiktok live likes", keywords: ["live like", "live likes"], exclude: ["follower", "view"] },
    { label: "Favorites", icon: "⭐", search: "tiktok favorites", keywords: ["favorite", "favorites", "save", "saves"], exclude: ["follower", "view"] },
    { label: "Shares", icon: "↗️", search: "tiktok shares", keywords: ["share", "shares"], exclude: ["follower", "view"] },
    { label: "Comments", icon: "💬", search: "tiktok comments", keywords: ["comment", "comments"], exclude: ["follower", "view"] }
  ],
  youtube: [
    { label: "Video Likes", icon: "👍", search: "youtube video likes", keywords: ["video like", "like", "likes"], exclude: ["subscriber", "view", "comment"] },
    { label: "Shorts Likes", icon: "▶️", search: "youtube shorts likes", keywords: ["shorts like", "short like"], exclude: ["subscriber", "view"] },
    { label: "Comment Likes", icon: "💬", search: "youtube comment likes", keywords: ["comment like", "comment likes"], exclude: ["subscriber", "view"] },
    { label: "Live Likes", icon: "📡", search: "youtube live likes", keywords: ["live like", "stream like"], exclude: ["subscriber", "view"] }
  ]
};

// Module-level flag that dedupes the mount-time RixeySMM catalog pre-fetch
// across re-renders so we don't double-fetch before `smmServices` state lands.
// Lives outside the component to avoid tripping the react-hooks/refs rule.
let smmCatalogPrefetched = false;

export function ServicesSection({ services, servicesBg, servicesCandidates }: ServicesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState("");
  const [selectedServicePrice, setSelectedServicePrice] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [presetQty, setPresetQty] = useState<number>(1000);

  // New state for "Other Services" visual selector modal
  const [isOtherModalOpen, setIsOtherModalOpen] = useState(false);
  const [otherServiceGroup, setOtherServiceGroup] = useState<OtherServiceGroup>("utilities");
  
  // New state for "RixeySMM Catalog" explorer modal
  const [isSmmCatalogModalOpen, setIsSmmCatalogModalOpen] = useState(false);

  // Real-time SMM catalog caching states
  const [smmServices, setSmmServices] = useState<SmmService[]>([]);
  const [loadingSmm, setLoadingSmm] = useState(false);

  // Prefilled search & custom platform sub-modals states
  const [smmPrefilledSearch, setSmmPrefilledSearch] = useState("");
  const [platformSubModalOpen, setPlatformSubModalOpen] = useState(false);
  const [platformSubModalType, setPlatformSubModalType] = useState<PlatformType | null>(null);

  const [vipDiscountPercent, setVipDiscountPercent] = useState(0);
  const [platformAvailability, setPlatformAvailability] = useState<Record<string, boolean>>({
    facebook: true, instagram: true, tiktok: true, youtube: true
  });

  const applyVipPrice = (amount: number) => {
    if (!vipDiscountPercent || amount <= 0) return amount;
    return Number((amount * (100 - vipDiscountPercent) / 100).toFixed(2));
  };

  const ensureSmmServices = () => {
    if (smmServices.length > 0 || loadingSmm) return;
    setLoadingSmm(true);
    fetch("/api/smm/services")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSmmServices(data);
        }
      })
      .catch((err) => console.error("Error loading direct SMM services:", err))
      .finally(() => setLoadingSmm(false));
  };

  // Build a lookup set of SMM provider service IDs currently listed on
  // rixeysmm.shop. Used to flag database services whose upstream provider
  // service has been delisted so clients can't buy them.
  const availableSmmIds = new Set(
    smmServices.map((s) => String(s.id)).filter(Boolean)
  );

  const openPlatformServices = (platform: PlatformType) => {
    setPlatformSubModalType(platform);
    ensureSmmServices();
    setPlatformSubModalOpen(true);
  };

  const openSmmCatalog = (prefill?: string) => {
    if (prefill !== undefined) setSmmPrefilledSearch(prefill);
    ensureSmmServices();
    setIsSmmCatalogModalOpen(true);
  };

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      if (!isMounted || !data.user?.id) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("vip_plan, vip_expires_at")
        .eq("id", data.user.id)
        .single();

      if (isMounted && profile && isVipActive(profile)) {
        setVipDiscountPercent(getVipDiscountPercent(profile));
      }
    }).catch(() => {});

    // Pre-fetch the live RixeySMM catalog so we can flag database services
    // whose upstream provider service has been delisted. All setState calls
    // happen inside async callbacks so we don't trip the
    // react-hooks/set-state-in-effect rule; the module-level flag dedupes
    // across re-renders before `smmServices` state lands.
    if (!smmCatalogPrefetched && smmServices.length === 0) {
      smmCatalogPrefetched = true;
      fetch("/api/smm/services")
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && Array.isArray(data)) {
            setSmmServices(data);
          }
        })
        .catch((err) => {
          console.error("Error preloading SMM services:", err);
          smmCatalogPrefetched = false;
        });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    fetch("/api/smm/availability")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === "object") {
          setPlatformAvailability({
            facebook: data.facebook !== false,
            instagram: data.instagram !== false,
            tiktok: data.tiktok !== false,
            youtube: data.youtube !== false,
          });
        }
      })
      .catch(() => {});
  }, []);

  const getPlatformSmmCandidates = (platform: PlatformType) => {
    const reactionFallbacks = PLATFORM_REACTION_VARIANTS[platform].map((variant) => ({
      ...variant,
      item: null
    }));

    if (!smmServices || smmServices.length === 0) {
      return { follower: null, like: null, view: null, reactions: reactionFallbacks };
    }

    // Resolve configured SMM IDs from the active database services prop
    let targetFollowerSmmId: string | null = null;
    let targetLikeSmmId: string | null = null;
    let targetViewSmmId: string | null = null;

    services.forEach(srv => {
      const titleLower = srv.title.toLowerCase();
      const parsed = parseDescription(srv.description);
      const smmId = parsed?.smm_service_id ? String(parsed.smm_service_id) : null;
      if (!smmId) return;

      const containsFB = titleLower.includes("facebook") || titleLower.includes("fb");
      const containsIG = titleLower.includes("instagram") || titleLower.includes("ig");
      const containsTT = titleLower.includes("tiktok") || titleLower.includes("tt") || titleLower.includes("tik tok");
      const containsYT = titleLower.includes("youtube") || titleLower.includes("yt");

      const isFollower = titleLower.includes("follower") || titleLower.includes("subscriber") || titleLower.includes("sub");
      const isLike = titleLower.includes("like") || titleLower.includes("reaction") || titleLower.includes("react") || titleLower.includes("heart");
      const isView = titleLower.includes("view") || titleLower.includes("play");

      if (platform === "facebook" && containsFB) {
        if (isFollower) targetFollowerSmmId = smmId;
        else if (isLike) targetLikeSmmId = smmId;
        else if (isView) targetViewSmmId = smmId;
      } else if (platform === "instagram" && containsIG) {
        if (isFollower) targetFollowerSmmId = smmId;
        else if (isLike) targetLikeSmmId = smmId;
        else if (isView) targetViewSmmId = smmId;
      } else if (platform === "tiktok" && containsTT) {
        if (isFollower) targetFollowerSmmId = smmId;
        else if (isLike) targetLikeSmmId = smmId;
        else if (isView) targetViewSmmId = smmId;
      } else if (platform === "youtube" && containsYT) {
        if (isFollower) targetFollowerSmmId = smmId;
        else if (isLike) targetLikeSmmId = smmId;
        else if (isView) targetViewSmmId = smmId;
      }
    });

    // Filter for all services matching this platform
    const platformServices = smmServices.filter(s => {
      const cat = s.category.toLowerCase();
      const name = s.name.toLowerCase();
      
      if (platform === "facebook") {
        return cat.includes("facebook") || cat.includes("fb") || name.includes("facebook") || name.includes("fb");
      }
      return cat.includes(platform) || name.includes(platform);
    });

    if (platformServices.length === 0) {
      return { follower: null, like: null, view: null, reactions: reactionFallbacks };
    }

    // Helper to find cheapest service matching keywords, and avoiding unwanted ones
    const findCheapestMatching = (keywords: string[], excludeKeywords: string[] = [], usedIds: Set<string> = new Set()) => {
      const matches = platformServices.filter(s => {
        const nameLower = s.name.toLowerCase();
        const matchesKeywords = keywords.some(kw => nameLower.includes(kw));
        const matchesExclude = excludeKeywords.some(ex => nameLower.includes(ex));
        return matchesKeywords && !matchesExclude && !usedIds.has(String(s.id));
      });
      if (matches.length === 0) return null;
      matches.sort((a, b) => a.startingPrice - b.startingPrice);
      return matches[0];
    };

    const findSmmServiceByIdOrFallback = (configuredId: string | null, keywords: string[], exclude: string[] = []) => {
      if (configuredId) {
        const found = smmServices.find(s => String(s.id) === String(configuredId));
        if (found) return found;
      }
      return findCheapestMatching(keywords, exclude);
    };

    let follower = null;
    let like = null;
    let view = null;

    if (platform === "facebook") {
      follower = findSmmServiceByIdOrFallback(targetFollowerSmmId, ["follower", "profile", "page like", "page follower", "classic page"]);
      like = findSmmServiceByIdOrFallback(targetLikeSmmId, ["like", "reaction", "react", "photo like", "post like", "love", "haha", "wow", "sad", "angry"], ["follower", "view", "share"]);
      view = findSmmServiceByIdOrFallback(targetViewSmmId, ["view", "video", "play", "reach"], ["follower", "like", "reaction"]);
    } else if (platform === "instagram") {
      follower = findSmmServiceByIdOrFallback(targetFollowerSmmId, ["follower"]);
      like = findSmmServiceByIdOrFallback(targetLikeSmmId, ["like", "heart"], ["follower", "view", "comment"]);
      view = findSmmServiceByIdOrFallback(targetViewSmmId, ["view", "play", "reel", "video", "impression"], ["follower", "like"]);
    } else if (platform === "tiktok") {
      follower = findSmmServiceByIdOrFallback(targetFollowerSmmId, ["follower"]);
      like = findSmmServiceByIdOrFallback(targetLikeSmmId, ["like", "heart"], ["follower", "view", "comment"]);
      view = findSmmServiceByIdOrFallback(targetViewSmmId, ["view", "play", "video", "share"], ["follower", "like"]);
    } else if (platform === "youtube") {
      follower = findSmmServiceByIdOrFallback(targetFollowerSmmId, ["subscriber", "subscribers", "sub"]);
      like = findSmmServiceByIdOrFallback(targetLikeSmmId, ["like"], ["subscriber", "view", "comment"]);
      view = findSmmServiceByIdOrFallback(targetViewSmmId, ["view", "watch", "play"], ["subscriber", "like"]);
    }

    if (!follower) follower = findCheapestMatching(["follower"]) || platformServices[0];
    if (!like) like = findCheapestMatching(["like", "heart", "react"]) || platformServices[Math.min(1, platformServices.length - 1)];
    if (!view) view = findCheapestMatching(["view", "play", "video"]) || platformServices[Math.min(2, platformServices.length - 1)];

    const usedReactionIds = new Set<string>();
    const reactions = PLATFORM_REACTION_VARIANTS[platform].map((variant) => {
      const item = findCheapestMatching(variant.keywords, variant.exclude || [], usedReactionIds);
      if (item) usedReactionIds.add(String(item.id));
      return { ...variant, item };
    });

    return { follower, like, view, reactions };
  };

  function parseServiceIndicators(name: string, desc: string = "") {
    const combined = `${name} ${desc}`.toLowerCase();
    let start = "⚡ Instant";
    if (combined.includes("instant") || combined.includes("auto-start") || combined.includes("auto start")) {
      start = "⚡ Instant";
    } else if (combined.includes("0-1h") || combined.includes("0-1 hour") || combined.includes("within 1 hour")) {
      start = "⏱️ < 1 Hour";
    } else if (combined.includes("0-12h") || combined.includes("0-12 hour") || combined.includes("within 12 hours")) {
      start = "⏱️ < 12 Hours";
    } else if (combined.includes("0-24h") || combined.includes("within 24h") || combined.includes("24 hours")) {
      start = "⏱️ < 24 Hours";
    } else if (combined.includes("1-12h") || combined.includes("1-24h")) {
      start = "⏱️ 1-24 Hours";
    } else if (combined.includes("slow") || combined.includes("gradual")) {
      start = "⏱️ Gradual Start";
    }

    let speed = "⚡ Auto-Speed";
    const speedMatch = combined.match(/(\d+(?:k|m))\s*\/\s*day/i) || combined.match(/speed:\s*(\d+(?:k|m))\b/i) || combined.match(/(\d+(?:k|m))\s*speed/i);
    if (speedMatch && speedMatch[1]) {
      speed = `🚀 Speed: ${speedMatch[1].toUpperCase()}/day`;
    } else if (combined.includes("50k/day") || combined.includes("50k")) {
      speed = "🚀 Speed: 50K/day";
    } else if (combined.includes("10k/day") || combined.includes("10k")) {
      speed = "🚀 Speed: 10K/day";
    } else if (combined.includes("5k/day") || combined.includes("5k")) {
      speed = "🚀 Speed: 5K/day";
    } else if (combined.includes("1k/day") || combined.includes("1k")) {
      speed = "🚀 Speed: 1K/day";
    } else if (combined.includes("instant delivery") || combined.includes("super fast")) {
      speed = "🚀 Speed: Super Fast";
    }

    let refill = "🛡️ Stable";
    if (combined.includes("no refill") || combined.includes("no drop guarantee") || combined.includes("r0")) {
      refill = "⚠️ No Refill";
    } else if (combined.includes("30d refill") || combined.includes("30 days refill") || combined.includes("30 day refill") || combined.includes("r30")) {
      refill = "♻️ 30-Day Refill";
    } else if (combined.includes("60d refill") || combined.includes("60 days refill") || combined.includes("r60")) {
      refill = "♻️ 60-Day Refill";
    } else if (combined.includes("90d refill") || combined.includes("90 days refill") || combined.includes("r90")) {
      refill = "♻️ 90-Day Refill";
    } else if (combined.includes("lifetime refill") || combined.includes("lifetime drop guarantee") || combined.includes("auto-refill") || combined.includes("non drop") || combined.includes("non-drop")) {
      refill = "♾️ Lifetime Refill";
    } else if (combined.includes("refill")) {
      refill = "♻️ Refill Guaranteed";
    }

    return { start, speed, refill };
  }

  const handleOrder = (id: string, title: string, price: number, description?: any) => {
    // Check if this service has a redirect URL
    try {
      const parsed = parseDescription(description);
      if (parsed && parsed.redirect_url) {
        window.open(parsed.redirect_url, "_blank", "noopener,noreferrer");
        return;
      }
    } catch (e) {}

    setSelectedServiceId(id);
    setSelectedServiceTitle(title);
    setSelectedServicePrice(price);
    const isSingleQty = 
      title.toLowerCase().includes("page") || 
      title.toLowerCase().includes("gemini") || 
      title.toLowerCase().includes("pisowifi") ||
      title.toLowerCase().includes("piso wifi") ||
      title.toLowerCase().includes("eap") || 
      title.toLowerCase().includes("tplink") || 
      title.toLowerCase().includes("software") || 
      title.toLowerCase().includes("architectural") ||
      title.toLowerCase().includes("license") ||
      title.toLowerCase().includes("autonomous") ||
      title.toLowerCase().includes("bot");
    setPresetQty(isSingleQty ? 1 : 1000);
    setIsModalOpen(true);
  };

  // Segment services into utility bundles and dedicated PisoWiFi packages.
  const utilityServiceIds = [
    "530e797c-62d1-467a-bf23-310c169a7103", // Gemini Pro
    "8134f872-1738-44f1-adb0-bc341e64ace0", // EAP TP-Link
    "03185a81-49f3-4255-868e-9e9ec3189497"  // Architectural Software / Lifetime License
  ];

  const pisoWifiServiceIds = [
    "bace2033-2a35-491f-ad83-ab5fccffb6eb", // PisoWiFi
  ];

  const utilityServices = services.filter((s) => {
    const t = s.title.toLowerCase();
    return (
      utilityServiceIds.includes(s.id) ||
      t.includes("gemini") ||
      t.includes("eap") ||
      t.includes("tplink") ||
      t.includes("architectural") ||
      t.includes("software") ||
      t.includes("license")
    );
  });

  const pisoWifiServices = services.filter((s) => {
    const t = s.title.toLowerCase();
    return (
      pisoWifiServiceIds.includes(s.id) ||
      t.includes("pisowifi") ||
      t.includes("piso wifi")
    );
  });

  const specialServices = [...utilityServices, ...pisoWifiServices];

  // Core services are those that are not classified as special utility/package services
  const coreServices = services.filter((s) => !specialServices.some((o) => o.id === s.id));

  // Cheapest SMM followers candidates for each major platform to show separately
  const fbFollowers = services.find(s => s.id === "6ef1e136-c2c8-4719-8c12-b0f20504d15e") || services.find(s => s.title.toLowerCase() === "fb followers" || s.title.toLowerCase() === "facebook followers");
  const igFollowers = services.find(s => s.id === "46a89c42-2d12-40e9-b5fc-112f45ea2e88") || services.find(s => s.title.toLowerCase() === "ig followers" || s.title.toLowerCase() === "instagram followers");
  const tiktokFollowers = services.find(s => s.id === "2a98f123-1d42-45e3-82ef-fb347cda6541") || services.find(s => s.title.toLowerCase() === "tiktok followers");
  const ytSubscribers = services.find(s => s.id === "ab348d21-f123-45c1-bd76-e137fab62aa1") || services.find(s => s.title.toLowerCase() === "yt subscribers" || s.title.toLowerCase() === "youtube subscribers");

  const DEFAULT_CANDIDATES: ServiceCandidate[] = [
    {
      id: "facebook",
      emoji: "📘",
      tag: "FB Followers & Reactions",
      title: PLATFORM_CARD_COPY.facebook.title,
      description: PLATFORM_CARD_COPY.facebook.description,
      rate_prefix: "Starting Rate",
      rate_text: "₱25.18 per 1k boosts",
      theme_color: "#1877F2",
      btn_bg: "bg-[#1877F2] hover:bg-[#4e8df5]",
      glow_color: "rgba(24, 119, 242, 0.45)"
    },
    {
      id: "instagram",
      emoji: "📸",
      tag: "IG Followers & Likes",
      title: PLATFORM_CARD_COPY.instagram.title,
      description: PLATFORM_CARD_COPY.instagram.description,
      rate_prefix: "Starting Rate",
      rate_text: "₱37.47 per 1k boosts",
      theme_color: "#E1306C",
      btn_bg: "bg-[#E1306C] hover:bg-[#eb5286]",
      glow_color: "rgba(225, 48, 108, 0.45)"
    },
    {
      id: "tiktok",
      emoji: "🎵",
      tag: "TT Followers & Hearts",
      title: PLATFORM_CARD_COPY.tiktok.title,
      description: PLATFORM_CARD_COPY.tiktok.description,
      rate_prefix: "Starting Rate",
      rate_text: "₱30.00 per 1k boosts",
      theme_color: "#00F2FE",
      btn_bg: "bg-[#00F2FE] hover:bg-[#3bf5fe] text-black",
      glow_color: "rgba(0, 242, 254, 0.45)"
    },
    {
      id: "youtube",
      emoji: "🎥",
      tag: "YT Subs & Watch Time",
      title: PLATFORM_CARD_COPY.youtube.title,
      description: PLATFORM_CARD_COPY.youtube.description,
      rate_prefix: "Starting Rate",
      rate_text: "₱132.21 per 1k boosts",
      theme_color: "#FF0000",
      btn_bg: "bg-[#FF0000] hover:bg-[#ff3b3b]",
      glow_color: "rgba(255, 0, 0, 0.45)"
    },
    {
      id: "pisowifi-package",
      emoji: "Wifi",
      tag: "PISOWIFI BUNDLES",
      title: "PisoWiFi Bundles",
      caption: "Starter, Professional & Enterprise",
      description: "Ready-to-deploy PisoWiFi bundles with GCash QR checkout, receipt upload & manual admin review.",
      rate_prefix: "Package Rates",
      rate_text: "Starter \u20B15,800 | Professional \u20B18,500 | Enterprise \u20B111,000",
      theme_color: "#1877F2",
      btn_bg: "bg-[#1877F2] hover:bg-[#4e8df5]",
      glow_color: "rgba(24, 119, 242, 0.45)",
      video_url: "/pisowifi-promo.mp4"
    },
    {
      id: "other",
      emoji: "Layers",
      tag: "SPECIALTY TOOLS",
      title: "Specialty Tools",
      description: "Gemini subscriptions, EAP TP-Link router setups & pre-activated architectural design software.",
      rate_prefix: "Included services",
      rate_text: "Gemini AI, EAP routers & Architectural Software",
      theme_color: "#1877F2",
      btn_bg: "bg-[#1877F2] hover:bg-[#4e8df5]",
      glow_color: "rgba(24, 119, 242, 0.45)"
    },
    {
      id: "catalog",
      emoji: "Layers",
      tag: "1,100+ SERVICES",
      title: "Full Catalog",
      description: "Search & order from 1,100+ premium boosts at direct reseller prices \u2014 IG, TT, YT, Telegram, Twitter & more.",
      rate_prefix: "Direct Reseller Rates",
      rate_text: "Instagram Followers, TikTok Hearts, YouTube Sub Packs, Telegram, Twitter, & more",
      theme_color: "#1DB954",
      btn_bg: "bg-[#1DB954] hover:bg-[#1ed760] text-black",
      glow_color: "rgba(29, 185, 84, 0.45)"
    }

  ];

  const mergeCandidatesWithDefaults = (savedCandidates: unknown): ServiceCandidate[] => {
    const candidateOrder = ["facebook", "instagram", "tiktok", "youtube", "order-page", "hormachuelos-ai", "pisowifi-package", "other", "catalog"];
    const sortCandidates = (cards: ServiceCandidate[]) => [...cards].sort((a, b) => {
      const aRank = candidateOrder.indexOf(a.id || "");
      const bRank = candidateOrder.indexOf(b.id || "");
      return (aRank === -1 ? candidateOrder.length : aRank) - (bRank === -1 ? candidateOrder.length : bRank);
    });

    if (!Array.isArray(savedCandidates)) {
      return sortCandidates([
        ...DEFAULT_CANDIDATES.slice(0, 4),
        ORDER_PAGE_CANDIDATE,
        HORMACHUELOS_CANDIDATE,
        ...DEFAULT_CANDIDATES.slice(4)
      ]);
    }

    const merged = [...savedCandidates] as ServiceCandidate[];
    if (!merged.some((item) => typeof item === "object" && item !== null && "id" in item && (item as { id?: unknown }).id === ORDER_PAGE_CANDIDATE.id)) {
      merged.splice(Math.min(4, merged.length), 0, ORDER_PAGE_CANDIDATE);
    }
    if (!merged.some((item) => typeof item === "object" && item !== null && "id" in item && (item as { id?: unknown }).id === HORMACHUELOS_CANDIDATE.id)) {
      merged.splice(Math.min(5, merged.length), 0, HORMACHUELOS_CANDIDATE);
    }
    for (const candidate of DEFAULT_CANDIDATES) {
      if (!merged.some((item) => typeof item === "object" && item !== null && "id" in item && (item as { id?: unknown }).id === candidate.id)) {
        const insertIndex = candidate.id === "order-page"
          ? Math.min(4, merged.length)
          : candidate.id === "hormachuelos-ai"
            ? Math.min(5, merged.length)
            : candidate.id === "pisowifi-package"
              ? Math.min(6, merged.length)
              : merged.length;
        merged.splice(insertIndex, 0, candidate);
      }
    }

    // Backfill media fields (video_url, image_url, logo_url) from defaults onto
    // saved candidates that are missing them. Older saved configs predate these
    // fields, so without this the pisowifi / hormachuelos promo videos would
    // silently disappear whenever a DB config exists.
    const allDefaults = [ORDER_PAGE_CANDIDATE, HORMACHUELOS_CANDIDATE, ...DEFAULT_CANDIDATES];
    for (const card of merged) {
      const def = allDefaults.find((d) => d.id === card.id);
      if (!def) continue;
      if (!card.video_url && def.video_url) card.video_url = def.video_url;
      if (!card.image_url && def.image_url) card.image_url = def.image_url;
      if (!card.logo_url && def.logo_url) card.logo_url = def.logo_url;
    }

    return sortCandidates(merged);
  };

  const configuredCandidates = servicesCandidates && Array.isArray(servicesCandidates) && servicesCandidates.length > 0
    ? servicesCandidates
    : DEFAULT_CANDIDATES;
  const activeCandidates = mergeCandidatesWithDefaults(configuredCandidates);

  const getCandidateRateAmount = (rateText: string) => {
    const match = String(rateText || "").match(/₱\s*([\d,]+(?:\.\d+)?)/);
    if (!match) return null;
    const amount = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(amount) ? amount : null;
  };

  return (
    <>
      {/* 1. Choose Your Boost Tier Grid */}
      <section
        id="services"
        className={`w-full max-w-6xl mx-auto mt-12 mb-20 relative z-10 transition-all duration-300 ${
          servicesBg?.videoUrl
            ? "px-6 py-12 md:py-16 md:px-12 rounded-3xl overflow-hidden border border-white/[0.03] bg-black/25 backdrop-blur-md shadow-2xl"
            : "px-4"
        }`}
      >
        {/* Services Section Background Video/Media */}
        {servicesBg && servicesBg.videoUrl && (
          <div className="absolute inset-0 hidden overflow-hidden pointer-events-none -z-10 select-none md:block">
            {(() => {
              const isImage = (url: string) => {
                const cleanUrl = url.split("?")[0].toLowerCase();
                return (
                  cleanUrl.endsWith(".gif") ||
                  cleanUrl.endsWith(".jpg") ||
                  cleanUrl.endsWith(".jpeg") ||
                  cleanUrl.endsWith(".png") ||
                  cleanUrl.endsWith(".webp")
                );
              };
              if (isImage(servicesBg.videoUrl)) {
                return (
                  <img
                    src={servicesBg.videoUrl}
                    className="absolute inset-0 w-full h-full object-cover select-none"
                    alt="Services Section Background"
                    style={{ opacity: servicesBg.opacity }}
                  />
                );
              } else {
                return (
                  <video
                    src={servicesBg.videoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover select-none"
                    style={{ opacity: servicesBg.opacity }}
                  />
                );
              }
            })()}
            {/* Subtle Vignette Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/90 via-transparent to-[#0a0a0a]/90"></div>
          </div>
        )}

        <div className="flex flex-col items-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-center text-fg tracking-tight">
            Choose Your <span className="text-[#1877F2]">Boost Tier</span>
          </h2>
          <p className="text-muted text-xs mt-2 text-center max-w-md">
            CHOOSE
          </p>
        </div>

        {/* Premium Consolidated Homepage Grid (Mobile-First responsive grids) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center max-w-6xl mx-auto">
          {activeCandidates.map((card) => {
            // Determine button click action
            const isPlatform = card.id === "facebook" || card.id === "instagram" || card.id === "tiktok" || card.id === "youtube";
            const isAvailable = !isPlatform || platformAvailability[card.id] !== false;
            const isComingSoon = card.coming_soon === true;
            const comingSoonHref = card.page_href || "/hormachuelos-ai";
            let clickAction = () => {};
            if (isComingSoon) {
              clickAction = () => {
                window.location.href = comingSoonHref;
              };
            } else if (card.id === "facebook") {
              clickAction = () => { if (isAvailable) openPlatformServices("facebook"); };
            } else if (card.id === "instagram") {
              clickAction = () => { if (isAvailable) openPlatformServices("instagram"); };
            } else if (card.id === "tiktok") {
              clickAction = () => { if (isAvailable) openPlatformServices("tiktok"); };
            } else if (card.id === "youtube") {
              clickAction = () => { if (isAvailable) openPlatformServices("youtube"); };
            } else if (card.id === "order-page") {
              clickAction = () => {
                window.location.href = "/order-page";
              };
            } else if (card.id === "other") {
              if (utilityServices.length === 0) return null;
              clickAction = () => {
                setOtherServiceGroup("utilities");
                setIsOtherModalOpen(true);
              };
            } else if (card.id === "pisowifi-package") {
              if (pisoWifiServices.length === 0) return null;
              clickAction = () => {
                setOtherServiceGroup("pisowifi");
                setIsOtherModalOpen(true);
              };
            } else if (card.id === "catalog") {
              clickAction = () => openSmmCatalog();
            } else {
              clickAction = () => {
                openSmmCatalog(card.tag || card.title || "");
              };
            }

            // Determine button bg and text colors
            const btnBgColor = card.theme_color;
            const btnTextColor = card.id === "tiktok" || card.id === "catalog" ? "text-black font-extrabold" : "text-white font-extrabold";
            const platformChips = card.id === "facebook" || card.id === "instagram" || card.id === "tiktok" || card.id === "youtube"
              ? PLATFORM_SERVICE_CHIPS[card.id as PlatformType]
              : null;
            const cardLayout = card.layout || "standard";
            const cardLayoutClass = cardLayout === "wide" ? "lg:col-span-2" : "";
            const cardPaddingClass = cardLayout === "compact" ? "p-6" : "p-8";
            const candidateRateAmount = getCandidateRateAmount(card.rate_text);
            const candidateVipAmount = candidateRateAmount ? applyVipPrice(candidateRateAmount) : null;
            const hasCandidateVipPrice = Boolean(vipDiscountPercent && candidateRateAmount && candidateVipAmount && candidateVipAmount < candidateRateAmount);
            const candidateImageUrl = card.image_url?.trim();
            const candidateVideoUrl = card.video_url?.trim();

            return (
              <div 
                key={card.id} 
                className={`relative bg-elevated/50 hover:bg-elevated/90 backdrop-blur-md rounded-3xl ${cardPaddingClass} ${cardLayoutClass} flex flex-col items-start text-left w-full border border-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group`}
                style={{ 
                  boxShadow: `0 12px 40px rgba(0,0,0,0.4)`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 35px ${card.glow_color || 'rgba(29, 185, 84, 0.15)'}`;
                  e.currentTarget.style.borderColor = `${card.theme_color}30`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.4)`;
                  e.currentTarget.style.borderColor = `rgba(255, 255, 255, 0.04)`;
                }}
              >
                {!isAvailable && isPlatform && (
                  <div className="absolute top-4 right-4 z-10 bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                    Temporarily Unavailable
                  </div>
                )}
                {isComingSoon && (
                  <div className="absolute top-4 right-4 z-10 bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 text-[#a78bfa] text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse"></span>
                    Coming Soon
                  </div>
                )}
                {candidateVideoUrl ? (
                  <div
                    className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden mb-5 border bg-black/30 shadow-inner"
                    style={{ borderColor: `${card.theme_color}25` }}
                  >
                    <video
                      src={candidateVideoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none"></div>
                  </div>
                ) : candidateImageUrl ? (
                  <div
                    className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden mb-5 border bg-black/30 shadow-inner"
                    style={{ borderColor: `${card.theme_color}25` }}
                  >
                    <img
                      src={candidateImageUrl}
                      alt={`${card.title} service`}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none"></div>
                  </div>
                ) : (
                  <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
                    {card.logo_url || REAL_LOGOS[card.id] ? (
                      <img
                        src={card.logo_url || REAL_LOGOS[card.id]}
                        alt={`${card.title} logo`}
                        className="w-14 h-14 object-contain mb-4"
                        style={{ filter: `drop-shadow(0 0 14px ${card.theme_color}55)` }}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : card.emoji === "Layers" ? (
                      <Layers
                        size={40}
                        className="mb-4"
                        style={{
                          color: card.theme_color,
                          filter: `drop-shadow(0 0 12px ${card.theme_color}45)`
                        }}
                      />
                    ) : card.id === "pisowifi-package" ? (
                      <Wifi
                        size={40}
                        className="mb-4"
                        style={{
                          color: card.theme_color,
                          filter: `drop-shadow(0 0 12px ${card.theme_color}45)`
                        }}
                      />
                    ) : (
                      <span
                        className="text-4xl mb-4 select-none"
                        style={{
                          filter: `drop-shadow(0 0 12px ${card.theme_color}45)`
                        }}
                      >
                        {card.emoji}
                      </span>
                    )}
                  </div>
                )}
                
                <h3 
                  className="uppercase text-xs font-black tracking-widest mb-2"
                  style={{ color: card.theme_color }}
                >
                  {card.tag}
                </h3>
                
                <h4 
                  className="text-xl font-bold text-fg mb-3 transition-colors group-hover:text-fg"
                  onMouseEnter={(e) => e.currentTarget.style.color = card.theme_color}
                  onMouseLeave={(e) => e.currentTarget.style.color = "white"}
                >
                  {card.title}
                </h4>

                {card.caption && (
                  <p
                    className="text-[11px] font-black uppercase tracking-wider mb-3"
                    style={{ color: card.theme_color }}
                  >
                    {card.caption}
                  </p>
                )}
                
                <p className="text-muted text-sm leading-relaxed mb-8 flex-grow">
                  {card.description}
                </p>

                {platformChips && (
                  <div className="w-full mb-6">
                    <span className="block text-muted text-[9px] font-black uppercase tracking-wider mb-2">
                      Services Inside
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {platformChips.map((chip) => (
                        <span
                          key={chip}
                          className="px-2.5 py-1 rounded-full border text-[10px] font-extrabold leading-none bg-black/25"
                          style={{
                            borderColor: `${card.theme_color}30`,
                            color: card.theme_color
                          }}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-border/60">
                  <div className="w-full text-left">
                    {isComingSoon ? (
                      <span className="block">
                        <span className="block text-muted text-[10px] font-bold uppercase tracking-wider mb-1">
                          {card.rate_prefix}
                        </span>
                        <span className="block text-2xl font-black text-[#a78bfa]">
                          {card.rate_text}
                        </span>
                      </span>
                    ) : hasCandidateVipPrice && candidateRateAmount && candidateVipAmount ? (
                      <span className="block leading-tight">
                        <span className="block text-muted text-[11px] font-mono line-through">
                          Regular ₱{candidateRateAmount.toFixed(2)}
                        </span>
                        <span className="block text-2xl font-black text-[#1DB954]">
                          VIP ₱{candidateVipAmount.toFixed(2)}
                          <span className="text-xs text-muted font-normal">
                            {card.id === "order-page" ? " package" : " per 1k"}
                          </span>
                        </span>
                      </span>
                    ) : card.id === "facebook" || card.id === "instagram" || card.id === "tiktok" || card.id === "youtube" ? (
                      <span className="text-2xl font-black text-fg">
                        {card.rate_text.split(" ")[0]} <span className="text-xs text-muted font-normal">{card.rate_text.split(" ").slice(1).join(" ")}</span>
                      </span>
                    ) : (
                      <span className="block text-muted text-[10px] font-extrabold uppercase tracking-wider line-clamp-2 leading-tight">
                        {card.rate_text}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={clickAction}
                  disabled={!isAvailable && isPlatform && !isComingSoon}
                  className={`w-full py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg text-center ${!isAvailable && isPlatform && !isComingSoon ? "opacity-50 cursor-not-allowed bg-slate-800 text-slate-400" : `${isComingSoon ? "text-white" : btnTextColor} cursor-pointer`}`}
                  style={!isAvailable && isPlatform && !isComingSoon ? {} : {
                    backgroundColor: btnBgColor,
                    boxShadow: `0 8px 20px ${card.theme_color}20`
                  }}
                  onMouseEnter={(e) => { if (isAvailable || !isPlatform || isComingSoon) e.currentTarget.style.filter = "brightness(1.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
                >
                  {isComingSoon ? "NOTIFY ME" : card.id === "order-page" ? "ORDER PAGE" : card.id === "pisowifi-package" ? "VIEW PACKAGES" : !isAvailable && isPlatform ? "UNAVAILABLE" : "VIEW"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Customer reviews Grid & Form */}
      <ReviewsSection />

      {/* 4.5 Comparison Grid - CYNETWORK vs Faceless SMM Panels */}
      <section className="w-full max-w-5xl mx-auto px-4 mt-24 mb-20 relative z-10">
        <div className="text-center mb-12">
          <span className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 font-black text-[10px] tracking-widest uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3">
            ⚖️ Strategic Advantage
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-center text-fg tracking-tight">
            How <span className="text-[#1DB954]">CYNETWORK</span> Wins Against Wholesale Panels
          </h2>
          <p className="text-sm text-muted mt-2 font-medium">
            Unlike sterile automated direct SMM panels (like RixeySMM), we offer premium curated layers of safety and trust
          </p>
        </div>

        <div className="bg-elevated/50 backdrop-blur-xl border border-white/[0.04] rounded-3xl overflow-hidden shadow-2xl">
          {/* Grid Header (Hidden on Mobile) */}
          <div className="hidden md:grid grid-cols-3 border-b border-border/80 bg-black/40 py-5 px-8 text-xs font-black uppercase tracking-wider text-muted text-left">
            <div>Core Feature</div>
            <div className="text-[#1DB954] flex items-center gap-1.5">🟢 CYNETWORK Curation</div>
            <div className="text-muted flex items-center gap-1.5">🔴 Faceless Wholesale SMM Panels</div>
          </div>

          {/* Feature 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-900/60 py-6 px-6 sm:px-8 hover:bg-elevated/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-fg uppercase tracking-wide">Account Safety</h4>
              <p className="text-[11px] text-muted mt-0.5 font-medium leading-normal">Compliance & page health protection.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                🛡️ 100% Adsense & Compliant
              </span>
              <p className="text-xs text-fg leading-relaxed font-semibold">
                Filters out toxic direct-bot server pools that trigger platform restrictions or monetization bans.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-muted flex items-center gap-1.5">
                ⚠️ Raw Unfiltered Delivery
              </span>
              <p className="text-xs text-muted leading-relaxed font-semibold">
                Direct raw bots easily flagged by platform algorithms, risking immediate page deletion or restrictions.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-900/60 py-6 px-6 sm:px-8 hover:bg-elevated/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-fg uppercase tracking-wide">Profile Quality</h4>
              <p className="text-[11px] text-muted mt-0.5 font-medium leading-normal">Retention rates and account realism.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                🇵🇭 Curated PH Base & Organic Realism
              </span>
              <p className="text-xs text-fg leading-relaxed font-semibold">
                Curates realistic local accounts with actual human avatars and activity histories for maximum retention.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-muted flex items-center gap-1.5">
                🤖 Sterile Foreign Bot Spams
              </span>
              <p className="text-xs text-muted leading-relaxed font-semibold">
                Uses massive foreign accounts (mixed Russian, Turkish, Vietnamese) with zero local relevance that drop rapidly.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-900/60 py-6 px-6 sm:px-8 hover:bg-elevated/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-fg uppercase tracking-wide">Payment & Top-Ups</h4>
              <p className="text-[11px] text-muted mt-0.5 font-medium leading-normal">Convenience and transaction speed.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                📲 Seamless GCash Direct QR
              </span>
              <p className="text-xs text-fg leading-relaxed font-semibold">
                Frictionless manual GCash payment scans with instant developer approval. No processing fee.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-muted flex items-center gap-1.5">
                💳 Crypto & High Deposits
              </span>
              <p className="text-xs text-muted leading-relaxed font-semibold">
                Requires crypto wallets, international credit cards, and steep minimum balances to perform single orders.
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="grid grid-cols-1 md:grid-cols-3 py-6 px-6 sm:px-8 hover:bg-elevated/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-fg uppercase tracking-wide">Client Assistance</h4>
              <p className="text-[11px] text-muted mt-0.5 font-medium leading-normal">Direct human contact and guarantees.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                💬 24/7 Developer Handshake
              </span>
              <p className="text-xs text-fg leading-relaxed font-semibold">
                Direct client support backed by Cyrhiel Moralla. Real human answers in quick Taglish/English.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-muted flex items-center gap-1.5">
                🤖 Delayed Robotic Tickets
              </span>
              <p className="text-xs text-muted leading-relaxed font-semibold">
                Faceless ticket forms with 48h delay, often replying with generic technical errors that offer zero actual help.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FAQs Section */}
      <FaqSection />

      {/* 6. Checkout Order Modal */}
      <OrderModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        serviceId={selectedServiceId}
        serviceTitle={selectedServiceTitle}
        serviceBasePrice={selectedServicePrice}
        presetQuantity={presetQty}
        service={selectedService}
        availableSmmIds={availableSmmIds}
      />

      {/* 7. Other Services Selection Sub-Modal */}
      {isOtherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-elevated/95 border border-border/80 rounded-3xl w-full max-w-5xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            <button 
              onClick={() => {
                setIsOtherModalOpen(false);
                setOtherServiceGroup("utilities");
              }}
              className="absolute top-6 right-6 text-muted hover:text-fg transition-colors p-1.5 hover:bg-elevated rounded-xl z-20 cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
            
            <div className="p-8 sm:p-10 border-b border-border/50">
              <h2 className="text-2xl sm:text-3xl font-black text-fg tracking-tight">
                {otherServiceGroup === "pisowifi" ? (
                  <>
                    PISOWIFI <span className="text-[#1877F2]">PACKAGE</span>
                  </>
                ) : (
                  <>
                    Other <span className="text-[#1877F2]">Premium Services</span>
                  </>
                )}
              </h2>
              <p className="text-muted text-sm mt-1.5">
                {otherServiceGroup === "pisowifi"
                  ? "Starter, Professional, and Enterprise PisoWiFi bundles with the retained GCash QR checkout."
                  : "Configure your custom activation or specialty utility subscriptions."}
              </p>
            </div>
            
            <div className="overflow-y-auto p-8 sm:p-10 flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {(otherServiceGroup === "pisowifi" ? pisoWifiServices : utilityServices).map((service) => (
                  <ServiceCard 
                    key={service.id}
                    id={service.id}
                    title={service.title}
                    description={service.description}
                    startingPrice={service.starting_price}
                    iconType={service.icon_type}
                    vipDiscountPercent={vipDiscountPercent}
                    availableSmmIds={availableSmmIds}
                    onOrder={(id, title, price) => {
                      setIsOtherModalOpen(false); // Auto-close selector sub-modal
                      setOtherServiceGroup("utilities");
                      setSelectedService(service);
                      handleOrder(id, title, price, service.description); // Fire the core order/redirect process
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. SMM Panel Catalog Modal */}
      <SmmCatalogModal 
        isOpen={isSmmCatalogModalOpen}
        prefilledSearch={smmPrefilledSearch}
        onClose={() => {
          setIsSmmCatalogModalOpen(false);
          setSmmPrefilledSearch("");
        }}
      />

      {/* 9. Platform-Specific SMM Timing Candidates Sub-Modal */}
      {platformSubModalOpen && platformSubModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-elevated/95 border border-border/80 rounded-3xl w-full max-w-5xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            {/* Close Button */}
            <button 
              onClick={() => {
                setPlatformSubModalOpen(false);
                setPlatformSubModalType(null);
              }}
              className="absolute top-6 right-6 text-muted hover:text-fg transition-colors p-1.5 hover:bg-elevated rounded-xl z-20 cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
            
            {/* Header */}
            <div className="p-8 sm:p-10 border-b border-border/60 bg-[#161616]/40 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl">
                  {platformSubModalType === "facebook" ? "📘" : platformSubModalType === "instagram" ? "📸" : platformSubModalType === "tiktok" ? "🎵" : "🎥"}
                </span>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-fg tracking-tight">
                    {platformSubModalType.toUpperCase()} <span className="text-[#1DB954]">CHEAPEST BOOSTS</span>
                  </h2>
                  <p className="text-muted text-xs sm:text-sm mt-1">Direct reseller pricing on the absolute lowest, organic-timing candidate packages.</p>
                </div>
              </div>
            </div>
            
            {/* Body */}
            <div className="overflow-y-auto p-8 sm:p-10 flex-grow">
              {loadingSmm ? (
                <div className="flex flex-col justify-center items-center py-20 gap-3">
                  <Loader2 size={36} className="text-[#1DB954] animate-spin" />
                  <span className="text-xs font-bold text-muted uppercase tracking-widest animate-pulse">Filtering cheapest timing candidates...</span>
                </div>
              ) : (() => {
                const candidates = getPlatformSmmCandidates(platformSubModalType);
                const hasReactionOptions = candidates.reactions.length > 0;
                if (!candidates.follower && !candidates.like && !candidates.view && !hasReactionOptions) {
                  return (
                    <div className="text-center py-16 bg-[#161616]/30 border border-border border-dashed rounded-2xl">
                      <p className="text-muted font-extrabold uppercase tracking-wider text-sm">Reseller catalog timing list loading...</p>
                      <p className="text-xs text-muted mt-1">If this persists, click &quot;View Other Services&quot; below to browse the backup database.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                      {[
                        { title: "👥 FOLLOWER / SUBSCRIBER PACK", item: candidates.follower },
                        { title: "❤️ POST LIKE / REACTION PACK", item: candidates.like },
                        { title: "▶️ DIRECT VIEWS / PLAYS PACK", item: candidates.view }
                      ].map((slot, index) => {
                        const s = slot.item;
                        if (!s) return null;
                        const indicators = parseServiceIndicators(s.name, s.desc);
                        const regularPer1k = s.startingPrice * 1000;
                        const vipPer1k = applyVipPrice(regularPer1k);
                        const hasVipPer1k = vipDiscountPercent > 0 && vipPer1k < regularPer1k;
                        return (
                          <div 
                            key={index}
                            className="bg-card/60 border border-border p-6 rounded-2xl flex flex-col justify-between hover:border-[#1DB954]/30 hover:bg-elevated transition-all duration-350 hover:-translate-y-1 hover:shadow-[0_4px_25px_rgba(29,185,84,0.08)]"
                          >
                            <div>
                              <h4 className="text-[10px] font-black uppercase tracking-wider text-[#1DB954] mb-2">{slot.title}</h4>
                              <h5 className="text-sm font-bold text-fg line-clamp-2 leading-snug mb-3">{s.name}</h5>
                              
                              {/* Timing Indicators */}
                              <div className="flex flex-col gap-1.5 mb-4 select-none">
                                <span className="inline-flex items-center text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 backdrop-blur-sm self-start">
                                  {indicators.start}
                                </span>
                                <span className="inline-flex items-center text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/15 backdrop-blur-sm self-start">
                                  {indicators.speed}
                                </span>
                                <span className={`inline-flex items-center text-[9px] font-extrabold px-2 py-0.5 rounded-md backdrop-blur-sm self-start ${
                                  indicators.refill.includes("No Refill")
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/15"
                                    : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/15"
                                }`}>
                                  {indicators.refill}
                                </span>
                              </div>
                              
                              <p className="text-[10px] text-muted font-extrabold uppercase tracking-wide">
                                SMM ID: #{s.id}
                              </p>
                              {s.desc && (
                                <p className="text-[10px] text-muted mt-2 bg-black/20 p-2.5 rounded-xl border border-slate-900/60 line-clamp-2 leading-relaxed">
                                  {s.desc}
                                </p>
                              )}
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-border/60">
                              <div className="flex justify-between items-baseline mb-4">
                                <span className="text-[9px] text-muted font-extrabold uppercase tracking-wider">Rate per 1k:</span>
                                {hasVipPer1k ? (
                                  <span className="text-right leading-tight">
                                    <span className="block text-[10px] text-muted line-through font-mono">₱{regularPer1k.toFixed(2)}</span>
                                    <span className="block text-base font-black text-[#1DB954]">VIP ₱{vipPer1k.toFixed(2)}</span>
                                  </span>
                                ) : (
                                  <span className="text-base font-black text-fg">₱{regularPer1k.toFixed(2)}</span>
                                )}
                              </div>
                              
                              <button
                                onClick={() => {
                                  // Auto-checkout flow: Close this modal and open SMM Modal prefilled with the service ID
                                  setPlatformSubModalOpen(false);
                                  setPlatformSubModalType(null);
                                  openSmmCatalog(s.id);
                                }}
                                type="button"
                                className="w-full bg-[#1DB954]/10 hover:bg-[#1DB954] text-[#1DB954] hover:text-black border border-[#1DB954]/30 hover:border-[#1DB954] font-extrabold py-2 rounded-xl transition-all text-xs uppercase tracking-widest cursor-pointer text-center"
                              >
                                Order Boost →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="max-w-4xl mx-auto bg-[#161616]/35 border border-border/80 rounded-3xl p-5 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
                        <div>
                          <h3 className="text-sm font-black text-fg uppercase tracking-widest">
                            All Services Inside
                          </h3>
                          <p className="text-xs text-slate-450 mt-1">
                            Pick the exact engagement type before checkout.
                          </p>
                        </div>
                        <span className="text-[10px] font-black text-[#1DB954] uppercase tracking-widest">
                          {platformSubModalType} service variants
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {candidates.reactions.map((reaction) => {
                          const service = reaction.item;
                          const reactionRegularPer1k = service ? service.startingPrice * 1000 : null;
                          const reactionVipPer1k = reactionRegularPer1k ? applyVipPrice(reactionRegularPer1k) : null;
                          const hasReactionVipPrice = Boolean(vipDiscountPercent && reactionRegularPer1k && reactionVipPer1k && reactionVipPer1k < reactionRegularPer1k);
                          return (
                            <button
                              key={reaction.label}
                              type="button"
                              onClick={() => {
                                setPlatformSubModalOpen(false);
                                setPlatformSubModalType(null);
                                openSmmCatalog(service ? String(service.id) : `${platformSubModalType} ${reaction.search}`);
                              }}
                              className="group/reaction text-left rounded-2xl border border-border bg-black/25 hover:bg-black/45 hover:border-[#1DB954]/35 p-3.5 transition-all duration-300 cursor-pointer min-h-[138px] flex flex-col"
                            >
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="text-2xl leading-none">{reaction.icon}</span>
                                <span className="text-[9px] text-slate-600 group-hover/reaction:text-[#1DB954] font-black uppercase tracking-widest">
                                  {service ? `#${service.id}` : "Browse"}
                                </span>
                              </div>
                              <span className="text-xs font-black text-fg leading-tight">
                                {reaction.label}
                              </span>
                              <span className="text-[10px] text-slate-450 leading-snug line-clamp-2 mt-1 flex-grow">
                                {service ? service.name : `Open catalog search for ${reaction.search}.`}
                              </span>
                              {hasReactionVipPrice && reactionRegularPer1k && reactionVipPer1k ? (
                                <span className="text-[10px] font-black text-[#1DB954] mt-3 leading-tight">
                                  <span className="block text-muted line-through">₱{reactionRegularPer1k.toFixed(2)}</span>
                                  <span className="block">VIP ₱{reactionVipPer1k.toFixed(2)} / 1k</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-black text-[#1DB954] mt-3">
                                  {service ? `₱${(service.startingPrice * 1000).toFixed(2)} / 1k` : "Search Catalog"}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Bottom Gateway to complete Catalog */}
                    <div className="text-center pt-4 max-w-sm mx-auto">
                      <button
                        onClick={() => {
                          setPlatformSubModalOpen(false);
                          setPlatformSubModalType(null);
                          openSmmCatalog(platformSubModalType); // Prefill search with platform name
                        }}
                        type="button"
                        className="w-full bg-slate-850 hover:bg-elevated border border-border text-fg hover:text-fg font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider cursor-pointer text-center"
                      >
                        View Other {platformSubModalType.charAt(0).toUpperCase() + platformSubModalType.slice(1)} Services Inside
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
            
          </div>
        </div>
      )}
    </>
  );
}
