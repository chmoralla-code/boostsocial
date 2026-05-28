import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Default candidates fallback structure
const DEFAULT_CANDIDATES = [
  {
    id: "facebook",
    emoji: "📘",
    tag: "Facebook Boosts",
    title: "Page & Reaction Menu",
    description: "Scale pages and posts with followers, views, comments, and exact Facebook reactions like Like, Heart/Love, Care, Haha, Wow, Sad, and Angry.",
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
    title: "Likes, Reels & Growth",
    description: "Build authority with targeted followers, post likes, reel likes, story likes, saves, shares, views, and profile impressions.",
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
    title: "Hearts, Shares & Views",
    description: "Amplify TikTok videos with followers, video hearts, live likes, favorites, comments, shares, and high-speed views.",
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
    title: "Subscribers & Likes",
    description: "Unlock monetization support with subscribers, watch hours, views, video likes, Shorts likes, comment likes, and live likes.",
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

    return NextResponse.json(data.value);
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

    // 2. Save to Backup Tokyo Database
    const backupUrl = process.env.BACKUP_SUPABASE_URL;
    const backupKey = process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY;
    if (backupUrl && backupKey) {
      try {
        const backupSupabase = createClient(backupUrl, backupKey, { auth: { persistSession: false } });
        await backupSupabase
          .from("settings")
          .upsert(
            { key: "services_candidates", value: candidates, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
      } catch (backupErr) {
        console.error("Backup DB services_candidates upsert failed:", backupErr);
      }
    }

    return NextResponse.json({ success: true, candidates });
  } catch (err: any) {
    console.error("POST services candidates error:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 550 });
  }
}
