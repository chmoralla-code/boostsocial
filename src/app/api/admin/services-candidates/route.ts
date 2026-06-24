import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

// Default candidates fallback structure
type CandidateRecord = {
  id: string;
  emoji: string;
  tag: string;
  title: string;
  caption?: string;
  description: string;
  rate_prefix: string;
  rate_text: string;
  layout?: string;
  theme_color: string;
  btn_bg: string;
  glow_color: string;
  image_url?: string;
  video_url?: string;
  coming_soon?: boolean;
  page_href?: string;
};

const DEFAULT_CANDIDATES: CandidateRecord[] = [
  {
    id: "facebook",
    emoji: "📘",
    tag: "FB Followers & Reactions",
    title: "Followers & Reactions",
    description: "FB followers, views, comments & 7 exact reactions — Like, Love, Care, Haha, Wow, Sad, Angry.",
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
    title: "Followers & Likes",
    description: "IG followers, post/reel/story likes, saves, shares, views & profile impressions.",
    rate_prefix: "Starting Rate",
    rate_text: "₱24.98 per 1k boosts",
    theme_color: "#E1306C",
    btn_bg: "bg-[#E1306C] hover:bg-[#eb5286]",
    glow_color: "rgba(225, 48, 108, 0.45)"
  },
  {
    id: "tiktok",
    emoji: "🎵",
    tag: "TT Followers & Hearts",
    title: "Followers & Hearts",
    description: "TT followers, video hearts, live likes, favorites, comments, shares & high-speed views.",
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
    title: "Subs & Watch Time",
    description: "YT subscribers, watch hours, video/Shorts likes, comment likes & live likes.",
    rate_prefix: "Starting Rate",
    rate_text: "₱198.32 per 1k boosts",
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
    rate_text: "Starter ₱5,800 | Professional ₱8,500 | Enterprise ₱11,000",
    theme_color: "#1877F2",
    btn_bg: "bg-[#1877F2] hover:bg-[#4e8df5]",
    glow_color: "rgba(24, 119, 242, 0.45)"
  },
  {
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
  },
  {
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
    description: "Search & order from 1,100+ premium boosts at direct reseller prices — IG, TT, YT, Telegram, Twitter & more.",
    rate_prefix: "Direct Reseller Rates",
    rate_text: "Instagram Followers, TikTok Hearts, YouTube Sub Packs, Telegram, Twitter, & more",
    theme_color: "#1DB954",
    btn_bg: "bg-[#1DB954] hover:bg-[#1ed760] text-black",
    glow_color: "rgba(29, 185, 84, 0.45)"

  }
];

function mergeDefaultCandidates(savedCandidates: unknown) {
  const candidateOrder = ["facebook", "instagram", "tiktok", "youtube", "order-page", "hormachuelos-ai", "pisowifi-package", "other", "catalog"];
  const sortCandidates = (cards: Array<{ id?: string }>) => [...cards].sort((a, b) => {
    const aRank = candidateOrder.indexOf(a.id || "");
    const bRank = candidateOrder.indexOf(b.id || "");
    return (aRank === -1 ? candidateOrder.length : aRank) - (bRank === -1 ? candidateOrder.length : bRank);
  });

  if (!Array.isArray(savedCandidates)) {
    return sortCandidates(DEFAULT_CANDIDATES);
  }

  const merged = [...savedCandidates];
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

  // Backfill media fields (video_url, image_url) from defaults onto saved
  // candidates that are missing them. Older saved configs predate these
  // fields, so without this the pisowifi / hormachuelos promo videos would
  // silently disappear whenever a DB config exists.
  for (const card of merged) {
    if (!card || typeof card !== "object") continue;
    const def = DEFAULT_CANDIDATES.find((d) => d.id === (card as { id?: string }).id);
    if (!def) continue;
    const c = card as { video_url?: string; image_url?: string };
    if (!c.video_url && def.video_url) c.video_url = def.video_url;
    if (!c.image_url && def.image_url) c.image_url = def.image_url;
  }

  return sortCandidates(merged);
}

// Helper to check if the user is a logged-in administrator
async function checkAdminAuth() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    return { authenticated: false, supabase: null };
  }
  return { authenticated: true, supabase };
}

export async function GET() {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "services_candidates")
      .single();

    if (error || !data) {
      return NextResponse.json(DEFAULT_CANDIDATES);
    }

    return NextResponse.json(mergeDefaultCandidates(data.value));
  } catch (err: any) {
    console.error("GET services candidates error:", err);
    return NextResponse.json(DEFAULT_CANDIDATES);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authenticated, supabase } = await checkAdminAuth();
    if (!authenticated || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const candidates = await req.json();

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: "Invalid candidates array structure" }, { status: 400 });
    }

    // 1. Save to Primary Database
    const { error: primaryErr } = await supabase
      .from("settings")
      .upsert(
        { key: "services_candidates", value: candidates, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (primaryErr) throw primaryErr;

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient
        .from("settings")
        .upsert(
          { key: "services_candidates", value: candidates, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
    }, "services_candidates upsert sync");

    return NextResponse.json({ success: true, candidates });
  } catch (err: any) {
    console.error("POST services candidates error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 550 });
  }
}
