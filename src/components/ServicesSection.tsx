"use client";

import { useState, useEffect } from "react";
import { ServiceCard } from "./ServiceCard";
import { OrderModal } from "./OrderModal";
import { PriceCalculator } from "./PriceCalculator";
import { StatCounters } from "./StatCounters";
import { FaqSection } from "./FaqSection";
import { ReviewsSection } from "./ReviewsSection";
import { SmmCatalogModal } from "./SmmCatalogModal";
import { Layers, X, Loader2 } from "lucide-react";
import { parseDescription, matchesServiceQualityFilter } from "@/utils/serviceHelpers";
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
  servicesCandidates?: any[] | null;
}

const ORDER_PAGE_CANDIDATE = {
  id: "order-page",
  emoji: "📄",
  tag: "ORDER PAGE",
  title: "Custom Facebook Page",
  caption: "Page setup + FB followers",
  description: "Launch a custom Facebook page with profile and cover assets, FB bio, transfer link, GCash or wallet checkout, and follower quantity priced from SMM #1141.",
  rate_prefix: "Base Package",
  rate_text: "₱1,999 includes 10k followers",
  layout: "standard",
  theme_color: "#1877F2",
  btn_bg: "bg-[#1877F2] hover:bg-[#4e8df5]",
  glow_color: "rgba(24, 119, 242, 0.45)"
};

const PLATFORM_SERVICE_CHIPS: Record<PlatformType, string[]> = {
  facebook: ["Like", "Heart/Love", "Care", "Haha", "Wow", "Sad", "Angry"],
  instagram: ["Post Likes", "Reel Likes", "Story Likes", "Saves", "Shares"],
  tiktok: ["Hearts", "Favorites", "Shares", "Comments", "Live Likes"],
  youtube: ["Video Likes", "Shorts Likes", "Comment Likes", "Live Likes"]
};

const PLATFORM_CARD_COPY: Record<PlatformType, { title: string; description: string }> = {
  facebook: {
    title: "Page & Reaction Menu",
    description: "Scale pages and posts with followers, views, comments, and exact Facebook reactions like Like, Heart/Love, Care, Haha, Wow, Sad, and Angry."
  },
  instagram: {
    title: "Likes, Reels & Growth",
    description: "Build authority with targeted followers, post likes, reel likes, story likes, saves, shares, views, and profile impressions."
  },
  tiktok: {
    title: "Hearts, Shares & Views",
    description: "Amplify TikTok videos with followers, video hearts, live likes, favorites, comments, shares, and high-speed views."
  },
  youtube: {
    title: "Subscribers & Likes",
    description: "Unlock monetization support with subscribers, watch hours, views, video likes, Shorts likes, comment likes, and live likes."
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

export function ServicesSection({ services, servicesBg, servicesCandidates }: ServicesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState("");
  const [selectedServicePrice, setSelectedServicePrice] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [presetQty, setPresetQty] = useState<number>(1000);

  // New state for "Other Services" visual selector modal
  const [isOtherModalOpen, setIsOtherModalOpen] = useState(false);
  
  // New state for "RixeySMM Catalog" explorer modal
  const [isSmmCatalogModalOpen, setIsSmmCatalogModalOpen] = useState(false);

  // Real-time SMM catalog caching states
  const [smmServices, setSmmServices] = useState<SmmService[]>([]);
  const [loadingSmm, setLoadingSmm] = useState(false);

  // Prefilled search & custom platform sub-modals states
  const [smmPrefilledSearch, setSmmPrefilledSearch] = useState("");
  const [platformSubModalOpen, setPlatformSubModalOpen] = useState(false);
  const [platformSubModalType, setPlatformSubModalType] = useState<PlatformType | null>(null);

  const [showCalculator, setShowCalculator] = useState(false);
  const [isOrganicFilter, setIsOrganicFilter] = useState(true);
  const [vipDiscountPercent, setVipDiscountPercent] = useState(0);

  const applyVipPrice = (amount: number) => {
    if (!vipDiscountPercent || amount <= 0) return amount;
    return Number((amount * (100 - vipDiscountPercent) / 100).toFixed(2));
  };

  useEffect(() => {
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
  }, []);

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

    return () => {
      isMounted = false;
    };
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

      const isFB = titleLower.includes("fb followers") || titleLower.includes("facebook followers") || titleLower.includes("fb reactions") || titleLower.includes("facebook reactions") || titleLower.includes("fb views") || titleLower.includes("facebook views");
      const isIG = titleLower.includes("ig followers") || titleLower.includes("instagram followers") || titleLower.includes("ig likes") || titleLower.includes("instagram likes") || titleLower.includes("ig views") || titleLower.includes("instagram views");
      const isTT = titleLower.includes("tiktok followers") || titleLower.includes("tiktok likes") || titleLower.includes("tiktok views");
      const isYT = titleLower.includes("yt subscribers") || titleLower.includes("youtube subscribers") || titleLower.includes("yt likes") || titleLower.includes("youtube likes") || titleLower.includes("yt views") || titleLower.includes("youtube views");

      if (platform === "facebook" && isFB) {
        if (titleLower.includes("follower")) targetFollowerSmmId = smmId;
        if (titleLower.includes("reaction") || titleLower.includes("like")) targetLikeSmmId = smmId;
        if (titleLower.includes("view")) targetViewSmmId = smmId;
      } else if (platform === "instagram" && isIG) {
        if (titleLower.includes("follower")) targetFollowerSmmId = smmId;
        if (titleLower.includes("like")) targetLikeSmmId = smmId;
        if (titleLower.includes("view")) targetViewSmmId = smmId;
      } else if (platform === "tiktok" && isTT) {
        if (titleLower.includes("follower")) targetFollowerSmmId = smmId;
        if (titleLower.includes("like") || titleLower.includes("heart")) targetLikeSmmId = smmId;
        if (titleLower.includes("view")) targetViewSmmId = smmId;
      } else if (platform === "youtube" && isYT) {
        if (titleLower.includes("subscriber") || titleLower.includes("sub")) targetFollowerSmmId = smmId;
        if (titleLower.includes("like")) targetLikeSmmId = smmId;
        if (titleLower.includes("view")) targetViewSmmId = smmId;
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

  const handleCalculatorOrder = (service: Service, quantity: number) => {
    setSelectedService(service);
    setSelectedServiceId(service.id);
    setSelectedServiceTitle(service.title);
    setSelectedServicePrice(service.starting_price);
    setPresetQty(quantity);
    setIsModalOpen(true);
  };

  // Segment services: otherServices are Gemini, PisoWiFi, EAP TP-Link, and Architectural Software (Lifetime License)
  const otherServiceIds = [
    "530e797c-62d1-467a-bf23-310c169a7103", // Gemini Pro
    "bace2033-2a35-491f-ad83-ab5fccffb6eb", // PisoWiFi
    "8134f872-1738-44f1-adb0-bc341e64ace0", // EAP TP-Link
    "03185a81-49f3-4255-868e-9e9ec3189497"  // Architectural Software / Lifetime License
  ];

  const otherServices = services.filter((s) => {
    const t = s.title.toLowerCase();
    return (
      otherServiceIds.includes(s.id) ||
      t.includes("gemini") ||
      t.includes("pisowifi") ||
      t.includes("eap") ||
      t.includes("tplink") ||
      t.includes("architectural") ||
      t.includes("software") ||
      t.includes("license")
    );
  });

  // Core services are those that are not classified as other services
  const coreServices = services.filter((s) => !otherServices.some((o) => o.id === s.id));

  // Cheapest SMM followers candidates for each major platform to show separately
  const fbFollowers = services.find(s => s.id === "6ef1e136-c2c8-4719-8c12-b0f20504d15e") || services.find(s => s.title.toLowerCase() === "fb followers" || s.title.toLowerCase() === "facebook followers");
  const igFollowers = services.find(s => s.id === "46a89c42-2d12-40e9-b5fc-112f45ea2e88") || services.find(s => s.title.toLowerCase() === "ig followers" || s.title.toLowerCase() === "instagram followers");
  const tiktokFollowers = services.find(s => s.id === "2a98f123-1d42-45e3-82ef-fb347cda6541") || services.find(s => s.title.toLowerCase() === "tiktok followers");
  const ytSubscribers = services.find(s => s.id === "ab348d21-f123-45c1-bd76-e137fab62aa1") || services.find(s => s.title.toLowerCase() === "yt subscribers" || s.title.toLowerCase() === "youtube subscribers");

  const DEFAULT_CANDIDATES = [
    {
      id: "facebook",
      emoji: "📘",
      tag: "Facebook Boosts",
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
      tag: "Instagram Boosts",
      title: PLATFORM_CARD_COPY.instagram.title,
      description: PLATFORM_CARD_COPY.instagram.description,
      rate_prefix: "Starting Rate",
      rate_text: "₱24.98 per 1k boosts",
      theme_color: "#E1306C",
      btn_bg: "bg-[#E1306C] hover:bg-[#eb5286]",
      glow_color: "rgba(225, 48, 108, 0.45)"
    },
    {
      id: "tiktok",
      emoji: "🎵",
      tag: "TikTok Boosts",
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
      tag: "YouTube Boosts",
      title: PLATFORM_CARD_COPY.youtube.title,
      description: PLATFORM_CARD_COPY.youtube.description,
      rate_prefix: "Starting Rate",
      rate_text: "₱132.21 per 1k boosts",
      theme_color: "#FF0000",
      btn_bg: "bg-[#FF0000] hover:bg-[#ff3b3b]",
      glow_color: "rgba(255, 0, 0, 0.45)"
    },
    {
      id: "other",
      emoji: "Layers",
      tag: "OTHER SERVICES",
      title: "Specialty & Utilities",
      description: "Premium digital memberships, PisoWiFi setups, network router optimizations, and pre-activated professional architectural design tools.",
      rate_prefix: "Included services",
      rate_text: "Gemini Subscriptions, PisoWiFi setups, EAP TP-Link routers, and Architectural Software",
      theme_color: "#1877F2",
      btn_bg: "bg-[#1877F2] hover:bg-[#4e8df5]",
      glow_color: "rgba(24, 119, 242, 0.45)"
    },
    {
      id: "catalog",
      emoji: "Layers",
      tag: "ALL SERVICES",
      title: "ALL SERVICES",
      description: "Instantly search and order from 1,100+ premium boosts and custom digital services at direct reseller pricing.",
      rate_prefix: "Direct Reseller Rates",
      rate_text: "Instagram Followers, TikTok Hearts, YouTube Sub Packs, Telegram, Twitter, & more",
      theme_color: "#1DB954",
      btn_bg: "bg-[#1DB954] hover:bg-[#1ed760] text-black",
      glow_color: "rgba(29, 185, 84, 0.45)"
    }

  ];

  const configuredCandidates = servicesCandidates && Array.isArray(servicesCandidates) && servicesCandidates.length > 0
    ? servicesCandidates
    : DEFAULT_CANDIDATES;
  const activeCandidates = configuredCandidates.some((card) => card.id === ORDER_PAGE_CANDIDATE.id)
    ? configuredCandidates
    : [
        ...configuredCandidates.slice(0, 4),
        ORDER_PAGE_CANDIDATE,
        ...configuredCandidates.slice(4)
      ];

  const filteredServicesForCalculator = services.filter((srv) => {
    const isOther = otherServices.some((o) => o.id === srv.id);
    if (isOther) return false;

    const desc = typeof srv.description === "string" ? srv.description : (srv.description?.description || "");
    return matchesServiceQualityFilter(srv.title, desc, "", isOrganicFilter);
  });

  const getCandidateRateAmount = (rateText: string) => {
    const match = String(rateText || "").match(/₱\s*([\d,]+(?:\.\d+)?)/);
    if (!match) return null;
    const amount = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(amount) ? amount : null;
  };

  return (
    <>
      {/* 1. SMM Price Calculator Widget Toggle */}
      <div className="w-full max-w-4xl mx-auto px-4 mt-6 relative z-10 flex flex-col items-center">
        {/* Organic & Non-Organic Filter Toggle */}
        <div className="w-full max-w-xs mx-auto mb-6 flex flex-col items-center">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#1DB954] mb-2 select-none">
            🌱 Service Quality Filter
          </span>
          <div className="relative flex p-1 bg-[#121212] border border-slate-800/80 rounded-full w-full shadow-inner select-none">
            {/* Sliding indicator */}
            <div
              className={`absolute top-1 bottom-1 rounded-full bg-gradient-to-r transition-all duration-300 ease-out pointer-events-none ${
                isOrganicFilter
                  ? "left-1 w-[48%] from-[#1DB954]/20 to-[#1ed760]/20 border border-[#1DB954]/30"
                  : "left-[51%] w-[48%] from-indigo-500/20 to-purple-500/20 border border-indigo-500/30"
              }`}
            ></div>
            
            <button
              onClick={() => setIsOrganicFilter(true)}
              className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-full transition-all duration-200 z-10 cursor-pointer flex items-center justify-center gap-1.5 ${
                isOrganicFilter ? "text-[#1DB954]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🌿 Organic
            </button>
            
            <button
              onClick={() => setIsOrganicFilter(false)}
              className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-full transition-all duration-200 z-10 cursor-pointer flex items-center justify-center gap-1.5 ${
                !isOrganicFilter ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🤖 Non-Organic
            </button>
          </div>
        </div>

        {!showCalculator ? (
          <button
            onClick={() => setShowCalculator(true)}
            className="px-10 py-5 rounded-full bg-gradient-to-r from-[#1DB954] to-[#1ed760] hover:from-[#1ed760] hover:to-[#1DB954] text-black font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all duration-300 transform hover:scale-[1.03] flex items-center gap-3 cursor-pointer border border-[#1DB954]/30"
          >
            <span className="text-base">📊</span> ESTIMATE
          </button>
        ) : (
          <div className="w-full relative animate-in fade-in slide-in-from-top-4 duration-500">
            <PriceCalculator 
              services={filteredServicesForCalculator} 
              vipDiscountPercent={vipDiscountPercent}
              onOrder={handleCalculatorOrder} 
            />
            <div className="flex justify-center -mt-10 mb-16">
              <button
                onClick={() => setShowCalculator(false)}
                className="px-6 py-2.5 rounded-full border border-slate-800 hover:border-slate-700 bg-slate-900/90 text-slate-400 hover:text-white transition-all duration-300 text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg"
              >
                Hide Calculator
              </button>
            </div>
          </div>
        )}
      </div>



      {/* 2. Brand Stat Counters */}
      <StatCounters />

      {/* 3. Choose Your Boost Tier Grid */}
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
          <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 select-none">
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
          <h2 className="text-3xl md:text-4xl font-black text-center text-white tracking-tight">
            Choose Your <span className="text-[#1877F2]">Boost Tier</span>
          </h2>
          <p className="text-slate-400 text-xs mt-2 text-center max-w-md">
            Premium growth bundles, high-speed reseller SMM boosts, and smart local hardware integration setups.
          </p>
        </div>

        {/* Premium Consolidated Homepage Grid (Mobile-First responsive grids) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center max-w-6xl mx-auto">
          {activeCandidates.map((card) => {
            // Determine button click action
            let clickAction = () => {};
            if (card.id === "facebook") {
              clickAction = () => {
                setPlatformSubModalType("facebook");
                setPlatformSubModalOpen(true);
              };
            } else if (card.id === "instagram") {
              clickAction = () => {
                setPlatformSubModalType("instagram");
                setPlatformSubModalOpen(true);
              };
            } else if (card.id === "tiktok") {
              clickAction = () => {
                setPlatformSubModalType("tiktok");
                setPlatformSubModalOpen(true);
              };
            } else if (card.id === "youtube") {
              clickAction = () => {
                setPlatformSubModalType("youtube");
                setPlatformSubModalOpen(true);
              };
            } else if (card.id === "order-page") {
              clickAction = () => {
                window.location.href = "/order-page";
              };
            } else if (card.id === "other") {
              if (otherServices.length === 0) return null;
              clickAction = () => setIsOtherModalOpen(true);
            } else if (card.id === "catalog") {
              clickAction = () => setIsSmmCatalogModalOpen(true);
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

            return (
              <div 
                key={card.id} 
                className={`bg-[#121212]/50 hover:bg-[#161616]/90 backdrop-blur-md rounded-3xl ${cardPaddingClass} ${cardLayoutClass} flex flex-col items-start text-left w-full border border-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-500 transform hover:-translate-y-2 group`}
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
                <div className="h-16 flex items-center justify-center group-hover:scale-115 group-hover:rotate-6 transition-transform duration-500 ease-out">
                  {card.emoji === "Layers" ? (
                    <Layers 
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
                
                <h3 
                  className="uppercase text-xs font-black tracking-widest mb-2"
                  style={{ color: card.theme_color }}
                >
                  {card.tag}
                </h3>
                
                <h4 
                  className="text-xl font-bold text-white mb-3 transition-colors group-hover:text-white"
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
                
                <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-grow">
                  {card.description}
                </p>

                {platformChips && (
                  <div className="w-full mb-6">
                    <span className="block text-slate-500 text-[9px] font-black uppercase tracking-wider mb-2">
                      Reaction Services Inside
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
                
                <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-slate-800/60">
                  <div className="w-full text-left">
                    <span className="block text-slate-550 text-[10px] font-bold uppercase tracking-wider mb-1">
                      {card.rate_prefix}
                    </span>
                    {hasCandidateVipPrice && candidateRateAmount && candidateVipAmount ? (
                      <span className="block leading-tight">
                        <span className="block text-[11px] text-slate-500 line-through font-mono">
                          Regular ₱{candidateRateAmount.toFixed(2)}
                        </span>
                        <span className="block text-2xl font-black text-[#1DB954]">
                          VIP ₱{candidateVipAmount.toFixed(2)}
                          <span className="text-xs text-slate-400 font-normal">
                            {card.id === "order-page" ? " package" : " per 1k"}
                          </span>
                        </span>
                      </span>
                    ) : card.id === "facebook" || card.id === "instagram" || card.id === "tiktok" || card.id === "youtube" ? (
                      <span className="text-2xl font-black text-white">
                        {card.rate_text.split(" ")[0]} <span className="text-xs text-slate-400 font-normal">{card.rate_text.split(" ").slice(1).join(" ")}</span>
                      </span>
                    ) : (
                      <span className="block text-slate-500 text-[10px] font-extrabold uppercase tracking-wider line-clamp-2 leading-tight">
                        {card.rate_text}
                      </span>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={clickAction}
                  className={`w-full py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg cursor-pointer text-center ${btnTextColor}`}
                  style={{ 
                    backgroundColor: btnBgColor,
                    boxShadow: `0 8px 20px ${card.theme_color}20`
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.filter = "none"}
                >
                  {card.id === "order-page" ? "ORDER PAGE" : "VIEW"}
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
          <h2 className="text-3xl md:text-4xl font-black text-center text-white tracking-tight">
            How <span className="text-[#1DB954]">CYNETWORK</span> Wins Against Wholesale Panels
          </h2>
          <p className="text-sm text-slate-400 mt-2 font-medium">
            Unlike sterile automated direct SMM panels (like RixeySMM), we offer premium curated layers of safety and trust
          </p>
        </div>

        <div className="bg-[#121212]/50 backdrop-blur-xl border border-white/[0.04] rounded-3xl overflow-hidden shadow-2xl">
          {/* Grid Header (Hidden on Mobile) */}
          <div className="hidden md:grid grid-cols-3 border-b border-slate-800/80 bg-black/40 py-5 px-8 text-xs font-black uppercase tracking-wider text-slate-400 text-left">
            <div>Core Feature</div>
            <div className="text-[#1DB954] flex items-center gap-1.5">🟢 CYNETWORK Curation</div>
            <div className="text-slate-555 flex items-center gap-1.5">🔴 Faceless Wholesale SMM Panels</div>
          </div>

          {/* Feature 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-900/60 py-6 px-6 sm:px-8 hover:bg-[#161616]/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">Account Safety</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-normal">Compliance & page health protection.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                🛡️ 100% Adsense & Compliant
              </span>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                Filters out toxic direct-bot server pools that trigger platform restrictions or monetization bans.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-550 flex items-center gap-1.5">
                ⚠️ Raw Unfiltered Delivery
              </span>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Direct raw bots easily flagged by platform algorithms, risking immediate page deletion or restrictions.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-900/60 py-6 px-6 sm:px-8 hover:bg-[#161616]/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">Profile Quality</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-normal">Retention rates and account realism.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                🇵🇭 Curated PH Base & Organic Realism
              </span>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                Curates realistic local accounts with actual human avatars and activity histories for maximum retention.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-550 flex items-center gap-1.5">
                🤖 Sterile Foreign Bot Spams
              </span>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Uses massive foreign accounts (mixed Russian, Turkish, Vietnamese) with zero local relevance that drop rapidly.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-900/60 py-6 px-6 sm:px-8 hover:bg-[#161616]/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">Payment & Top-Ups</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-normal">Convenience and transaction speed.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                📲 Seamless GCash Direct QR
              </span>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                Frictionless manual GCash payment scans with instant developer approval. No processing fee.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-550 flex items-center gap-1.5">
                💳 Crypto & High Deposits
              </span>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Requires crypto wallets, international credit cards, and steep minimum balances to perform single orders.
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="grid grid-cols-1 md:grid-cols-3 py-6 px-6 sm:px-8 hover:bg-[#161616]/40 transition-colors duration-200 text-left items-start gap-4 md:gap-0">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wide">Client Assistance</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-normal">Direct human contact and guarantees.</p>
            </div>
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs font-black text-[#1ed760] flex items-center gap-1.5">
                💬 24/7 Developer Handshake
              </span>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                Direct client support backed by Cyrhiel Moralla. Real human answers in quick Taglish/English.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black text-slate-550 flex items-center gap-1.5">
                🤖 Delayed Robotic Tickets
              </span>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
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
      />

      {/* 7. Other Services Selection Sub-Modal */}
      {isOtherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090909]/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-[#121212]/95 border border-slate-800/80 rounded-3xl w-full max-w-5xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setIsOtherModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-850 rounded-xl z-20 cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
            
            <div className="p-8 sm:p-10 border-b border-slate-800/50">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Other <span className="text-[#1877F2]">Premium Services</span>
              </h2>
              <p className="text-slate-400 text-sm mt-1.5">Configure your custom activation or specialty utility subscriptions.</p>
            </div>
            
            <div className="overflow-y-auto p-8 sm:p-10 flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {otherServices.map((service) => (
                  <ServiceCard 
                    key={service.id}
                    id={service.id}
                    title={service.title}
                    description={service.description}
                    startingPrice={service.starting_price}
                    iconType={service.icon_type}
                    vipDiscountPercent={vipDiscountPercent}
                    onOrder={(id, title, price) => {
                      setIsOtherModalOpen(false); // Auto-close selector sub-modal
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
          <div className="bg-[#121212]/95 border border-slate-800/80 rounded-3xl w-full max-w-5xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            {/* Close Button */}
            <button 
              onClick={() => {
                setPlatformSubModalOpen(false);
                setPlatformSubModalType(null);
              }}
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-850 rounded-xl z-20 cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>
            
            {/* Header */}
            <div className="p-8 sm:p-10 border-b border-slate-850/60 bg-[#161616]/40 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl">
                  {platformSubModalType === "facebook" ? "📘" : platformSubModalType === "instagram" ? "📸" : platformSubModalType === "tiktok" ? "🎵" : "🎥"}
                </span>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {platformSubModalType.toUpperCase()} <span className="text-[#1DB954]">CHEAPEST BOOSTS</span>
                  </h2>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">Direct reseller pricing on the absolute lowest, organic-timing candidate packages.</p>
                </div>
              </div>
            </div>
            
            {/* Body */}
            <div className="overflow-y-auto p-8 sm:p-10 flex-grow">
              {loadingSmm ? (
                <div className="flex flex-col justify-center items-center py-20 gap-3">
                  <Loader2 size={36} className="text-[#1DB954] animate-spin" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Filtering cheapest timing candidates...</span>
                </div>
              ) : (() => {
                const candidates = getPlatformSmmCandidates(platformSubModalType);
                const hasReactionOptions = candidates.reactions.length > 0;
                if (!candidates.follower && !candidates.like && !candidates.view && !hasReactionOptions) {
                  return (
                    <div className="text-center py-16 bg-[#161616]/30 border border-slate-800 border-dashed rounded-2xl">
                      <p className="text-slate-500 font-extrabold uppercase tracking-wider text-sm">Reseller catalog timing list loading...</p>
                      <p className="text-xs text-slate-650 mt-1">If this persists, click 'View Other Services' below to browse the backup database.</p>
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
                            className="bg-[#181818]/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between hover:border-[#1DB954]/30 hover:bg-[#1a1a1a] transition-all duration-350 hover:-translate-y-1 hover:shadow-[0_4px_25px_rgba(29,185,84,0.08)]"
                          >
                            <div>
                              <h4 className="text-[10px] font-black uppercase tracking-wider text-[#1DB954] mb-2">{slot.title}</h4>
                              <h5 className="text-sm font-bold text-white line-clamp-2 leading-snug mb-3">{s.name}</h5>
                              
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
                              
                              <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">
                                SMM ID: #{s.id}
                              </p>
                              {s.desc && (
                                <p className="text-[10px] text-slate-400 mt-2 bg-black/20 p-2.5 rounded-xl border border-slate-900/60 line-clamp-2 leading-relaxed">
                                  {s.desc}
                                </p>
                              )}
                            </div>
                            
                            <div className="mt-6 pt-4 border-t border-slate-850/60">
                              <div className="flex justify-between items-baseline mb-4">
                                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Rate per 1k:</span>
                                {hasVipPer1k ? (
                                  <span className="text-right leading-tight">
                                    <span className="block text-[10px] text-slate-500 line-through font-mono">₱{regularPer1k.toFixed(2)}</span>
                                    <span className="block text-base font-black text-[#1DB954]">VIP ₱{vipPer1k.toFixed(2)}</span>
                                  </span>
                                ) : (
                                  <span className="text-base font-black text-white">₱{regularPer1k.toFixed(2)}</span>
                                )}
                              </div>
                              
                              <button
                                onClick={() => {
                                  // Auto-checkout flow: Close this modal and open SMM Modal prefilled with the service ID
                                  setPlatformSubModalOpen(false);
                                  setPlatformSubModalType(null);
                                  setSmmPrefilledSearch(s.id);
                                  setIsSmmCatalogModalOpen(true);
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

                    <div className="max-w-4xl mx-auto bg-[#161616]/35 border border-slate-850/80 rounded-3xl p-5 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
                        <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">
                            Reaction Services Inside
                          </h3>
                          <p className="text-xs text-slate-450 mt-1">
                            Pick the exact engagement type before checkout.
                          </p>
                        </div>
                        <span className="text-[10px] font-black text-[#1DB954] uppercase tracking-widest">
                          {platformSubModalType} variants
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
                                setSmmPrefilledSearch(service ? String(service.id) : `${platformSubModalType} ${reaction.search}`);
                                setIsSmmCatalogModalOpen(true);
                              }}
                              className="group/reaction text-left rounded-2xl border border-slate-800 bg-black/25 hover:bg-black/45 hover:border-[#1DB954]/35 p-3.5 transition-all duration-300 cursor-pointer min-h-[138px] flex flex-col"
                            >
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="text-2xl leading-none">{reaction.icon}</span>
                                <span className="text-[9px] text-slate-600 group-hover/reaction:text-[#1DB954] font-black uppercase tracking-widest">
                                  {service ? `#${service.id}` : "Browse"}
                                </span>
                              </div>
                              <span className="text-xs font-black text-white leading-tight">
                                {reaction.label}
                              </span>
                              <span className="text-[10px] text-slate-450 leading-snug line-clamp-2 mt-1 flex-grow">
                                {service ? service.name : `Open catalog search for ${reaction.search}.`}
                              </span>
                              {hasReactionVipPrice && reactionRegularPer1k && reactionVipPer1k ? (
                                <span className="text-[10px] font-black text-[#1DB954] mt-3 leading-tight">
                                  <span className="block text-slate-500 line-through">₱{reactionRegularPer1k.toFixed(2)}</span>
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
                          setSmmPrefilledSearch(platformSubModalType); // Prefill search with platform name
                          setIsSmmCatalogModalOpen(true);
                        }}
                        type="button"
                        className="w-full bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-350 hover:text-white font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider cursor-pointer text-center"
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
