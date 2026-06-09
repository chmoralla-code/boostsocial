import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ServicesSection } from "@/components/ServicesSection";
import { HeroVideoBackground } from "@/components/HeroVideoBackground";
import { createClient } from "@/utils/supabase/server";
import { HeroSearch } from "@/components/HeroSearch";
import { PendingOrderBanner } from "@/components/PendingOrderBanner";
import { OnboardingRedirect } from "@/components/OnboardingRedirect";
import { FeatureBadgesGrid } from "@/components/FeatureBadgesGrid";
import { getEnv } from "@/utils/env";
import Link from "next/link";
import { ClipboardList, LogIn, Rocket, Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: true });

  // Fetch custom hero texts
  let heroTexts = {
    badge: "⚡ Next-Gen Amplification Engine",
    title: "MAS BARATO PA SA \n[FACEBOOK] {BOOSTING} SERVICES !",
    description: "Don't worry about transparency—we deliver [50 free trial] followers,\nreactions, or views so you can test our service before paying fully!"
  };
  try {
    const { data: textSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'hero_text')
      .single();
    if (textSetting && textSetting.value) {
      heroTexts = {
        badge: textSetting.value.badge || heroTexts.badge,
        title: textSetting.value.title || heroTexts.title,
        description: textSetting.value.description || heroTexts.description
      };
    }
  } catch (err) {
    console.error("Failed to load hero text settings:", err);
  }

  // Fetch custom services background settings
  let servicesBg = { videoUrl: "", opacity: 0.15 };
  try {
    const { data: bgSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "services_bg_settings")
      .single();
    if (bgSetting && bgSetting.value) {
      servicesBg = {
        videoUrl: bgSetting.value.videoUrl || "",
        opacity: bgSetting.value.opacity !== undefined ? Number(bgSetting.value.opacity) : 0.15
      };
    }
  } catch (err) {
    console.error("Failed to load services background settings:", err);
  }

  // Fetch custom service candidates
  let servicesCandidates = null;
  try {
    const { data: candidatesSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "services_candidates")
      .single();
    if (candidatesSetting && candidatesSetting.value) {
      servicesCandidates = candidatesSetting.value;
    }
  } catch (err) {
    console.error("Failed to load services candidates settings:", err);
  }

  // Fetch custom service showcase video
  let showcaseSettings = {
    videoUrl: "/hero-bg.mp4",
    posterUrl: "",
    title: "Real Service Delivery Samples",
    badge: "Legit & Fast"
  };
  try {
    const { data: showcaseSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "service_showcase")
      .single();
    if (showcaseSetting && showcaseSetting.value) {
      showcaseSettings = {
        videoUrl: showcaseSetting.value.videoUrl || "/hero-bg.mp4",
        posterUrl: showcaseSetting.value.posterUrl || "",
        title: showcaseSetting.value.title || showcaseSettings.title,
        badge: showcaseSetting.value.badge || showcaseSettings.badge
      };
    }
  } catch (err) {
    console.error("Failed to load service showcase settings:", err);
  }

  // Helper parser for primary title
  const parseTitle = (text: string) => {
    const regex = /(\[.*?\]|\{.*?\}|\\n|\n)/g;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        return (
          <span key={index} className="fb-shimmer-text">
            {part.slice(1, -1)}
          </span>
        );
      } else if (part.startsWith('{') && part.endsWith('}')) {
        return (
          <span key={index} className="spotify-shimmer-text">
            {part.slice(1, -1)}
          </span>
        );
      } else if (part === '\\n' || part === '\n') {
        return <br key={index} className="hidden md:inline" />;
      } else {
        return part;
      }
    });
  };

  // Helper parser for description paragraph
  const parseDescriptionText = (text: string) => {
    const regex = /(\[.*?\]|\{.*?\}|\\n|\n)/g;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if ((part.startsWith('[') && part.endsWith(']')) || (part.startsWith('{') && part.endsWith('}'))) {
        return (
          <span key={index} className="text-white">
            {part.slice(1, -1)}
          </span>
        );
      } else if (part === '\\n' || part === '\n') {
        return <br key={index} className="hidden sm:inline" />;
      } else {
        return part;
      }
    });
  };

  // Fetch custom hero video URL and opacity from Supabase Storage config
  let videoUrl = "/hero-bg.mp4";
  let opacity = 0.45;
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    if (supabaseUrl) {
      const configUrl = `${supabaseUrl}/storage/v1/object/public/receipts/admin-config/hero-video.png`;
      const res = await fetch(configUrl, { cache: "no-store" });
      if (res.ok) {
        const config = await res.json();
        videoUrl = config.videoUrl || "/hero-bg.mp4";
        opacity = config.opacity !== undefined ? Number(config.opacity) : 0.45;
      }
    }
  } catch (err) {
    console.error("Failed to load custom hero video configuration:", err);
  }

  return (
    <>
      <OnboardingRedirect />
      <Header />
      
      <main className="flex-grow flex flex-col items-center pt-8 sm:pt-14 md:pt-24 relative overflow-hidden bg-bg min-h-screen">
        {/* Video Background */}
        <HeroVideoBackground videoUrl={videoUrl} opacity={opacity} />
        
        {/* Futuristic Technical Grid Backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none -z-10 light-mode:bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)]"></div>
        
        {/* Spotify Neon Glow Backdrops */}
        <div className="absolute top-0 left-0 w-full h-[700px] overflow-hidden z-[1] pointer-events-none">
          <div className="absolute top-[-25%] left-[8%] w-[600px] h-[600px] rounded-full fb-glow-blob opacity-80"></div>
          <div className="absolute top-[15%] right-[-12%] w-[700px] h-[700px] rounded-full spotify-glow-blob opacity-80"></div>
          <div className="absolute top-[35%] left-[-15%] w-[600px] h-[600px] rounded-full spotify-glow-blob opacity-80"></div>
        </div>

        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-5 sm:pt-8 pb-12 sm:pb-16">
          {/* Left Column (Content & Search) */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Animated Tech Badge */}
            <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] sm:text-xs font-black tracking-widest text-primary mb-5 sm:mb-6 uppercase shadow-xl shadow-emerald-500/5 backdrop-blur-md animate-fade-in-up-1 text-center light-mode:bg-slate-100/50 light-mode:border-slate-200/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-dark opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              {heroTexts.badge}
            </div>

            <h1 className="text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.02] sm:leading-[1.05] mb-5 sm:mb-6 tracking-normal uppercase animate-fade-in-up-2 text-fg">
              {parseTitle(heroTexts.title)}
            </h1>
            
            <p className="text-sm sm:text-base md:text-lg text-muted mb-7 sm:mb-10 max-w-xl font-bold leading-relaxed animate-fade-in-up-3">
              {parseDescriptionText(heroTexts.description)}
            </p>
            
            <div className="w-full max-w-xl animate-fade-in-up-3 mb-8 sm:mb-10">
              <HeroSearch services={services || []} />
            </div>

            <div className="w-full max-w-xl grid grid-cols-2 gap-2 sm:grid-cols-4 animate-fade-in-up-3 mb-8 sm:mb-10">
              <Link href="#services" className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border border-primary/25 bg-primary/12 px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-primary transition hover:bg-primary hover:text-black">
                <Rocket size={16} />
                Browse Services
              </Link>
              <Link href="/app" className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-white/[0.04] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-fg transition hover:border-primary/50 hover:text-fg light-mode:border-slate-300 light-mode:bg-slate-100/50">
                <Smartphone size={16} />
                Open App
              </Link>
              <Link href="/track" className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-white/[0.04] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-fg transition hover:border-primary/50 hover:text-fg light-mode:border-slate-300 light-mode:bg-slate-100/50">
                <ClipboardList size={16} />
                Track Order
              </Link>
              <Link href="/login" className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-white/[0.04] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-fg transition hover:border-primary/50 hover:text-fg light-mode:border-slate-300 light-mode:bg-slate-100/50">
                <LogIn size={16} />
                Login/Register
              </Link>
            </div>

            {/* Value Propositions / Trust Highlights */}
            <FeatureBadgesGrid />
          </div>

          {/* Right Column (Premium Glassmorphic Video Showcase Player) */}
          <div className="lg:col-span-5 flex justify-center items-center relative animate-fade-in-up-3 w-full">
            {/* Ambient background glow for the showcase player */}
            <div className="absolute inset-0 bg-[#1DB954]/10 rounded-full blur-[80px] pointer-events-none scale-75 animate-pulse"></div>
            
            <div className="relative w-full max-w-[460px] rounded-[2.5rem] bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5 backdrop-blur-xl shadow-2xl hover:border-[#1DB954]/25 transition-all duration-500 overflow-hidden transform hover:-translate-y-1">
              {/* Glassmorphic border shimmer */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#1DB954]/5 to-transparent opacity-50"></div>
              
              {/* Video Player wrapper */}
              <div className="relative rounded-[2rem] overflow-hidden aspect-video border border-white/[0.06] bg-[#0c0c0c] shadow-inner group">
                <video 
                  src={showcaseSettings.videoUrl || "/hero-bg.mp4"} 
                  poster={showcaseSettings.posterUrl || "/gcash-qr.png"} // defaults to poster image if supplied
                  controls
                  loop
                  playsInline
                  className="w-full h-full object-cover rounded-[2rem]"
                />
              </div>

              {/* Showcase title bar */}
              <div className="mt-4 flex items-center justify-between px-2">
                <div className="text-left">
                  <div className="text-[9px] font-black text-[#1DB954] uppercase tracking-[0.2em] mb-0.5">🎥 Showcase Proof</div>
                  <h3 className="text-xs font-black text-white uppercase tracking-tight">{showcaseSettings.title}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/[0.05]">
                    {showcaseSettings.badge}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PendingOrderBanner />

        <ServicesSection services={services || []} servicesBg={servicesBg} servicesCandidates={servicesCandidates} />

        {/* 🌟 Premium About & Contact Section */}
      <section id="about" className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-16 sm:py-24 border-t border-border/40 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/2 to-transparent opacity-30 pointer-events-none blur-3xl"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          {/* About CYNETWORK */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] font-black tracking-widest text-primary uppercase light-mode:bg-slate-100/50 light-mode:border-slate-200/50">
              🚀 About CYNETWORK
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-fg leading-none">
              Next-Gen <span className="fb-shimmer-text">Social Amplification</span> Engine
            </h2>
            <p className="text-muted text-sm leading-relaxed font-semibold">
              CYNETWORK is the leading platform for instant social media boosting services in the Philippines. We specialize in providing lightning-fast, high-retention reactions, active followers, and organic views to kickstart your online brand presence.
            </p>
            <p className="text-muted text-sm leading-relaxed font-semibold">
              By pairing advanced API integration (such as RixeySMM workflows) with reliable master/replica databases, we ensure 100% service availability, automatic order fulfillment, and secure GCash transactions.
            </p>
            
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-1 light-mode:bg-slate-100/50 light-mode:border-slate-200/50">
                <div className="text-lg font-black text-primary">100% Safe</div>
                <div className="text-xs text-muted">No account password required. Only profile URL/links.</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-1 light-mode:bg-slate-100/50 light-mode:border-slate-200/50">
                <div className="text-lg font-black text-[#1877F2]">Instant Queue</div>
                <div className="text-xs text-muted">Most orders kickstart within 5-15 minutes of approval.</div>
              </div>
            </div>
          </div>
          
          {/* Contact & Support */}
          <div id="contact" className="lg:col-span-6 w-full rounded-[2rem] bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative light-mode:bg-slate-50/50 light-mode:border-slate-200/50">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <h3 className="text-xl font-black text-fg uppercase mb-2 tracking-tight">📬 Contact & Support</h3>
            <p className="text-muted text-xs mb-6">Have questions or need order assistance? Shoot us a message directly!</p>
            
            <div className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted tracking-wider">Email Address</label>
                <div className="w-full bg-elevated border border-border/80 rounded-xl px-4 py-3 text-xs text-fg font-semibold select-all">
                  support@cynetwork.ph
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted tracking-wider">Help Desk & Live Chat</label>
                <p className="text-muted text-xs leading-relaxed">
                  Registered users can open a live chat ticket directly in the app sidebar navigation by clicking on the Chat widget.
                </p>
              </div>
              
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Link href="/login" className="flex-1 bg-[#1877F2] hover:bg-[#4e8df5] text-white text-center font-extrabold py-3.5 rounded-xl transition-all duration-300 uppercase text-xs tracking-wider flex items-center justify-center gap-2">
                  Create Account
                </Link>
                <a href="mailto:support@cynetwork.ph" className="flex-1 border border-border bg-card/50 hover:bg-elevated/50 text-fg text-center font-extrabold py-3.5 rounded-xl transition-all duration-300 uppercase text-xs tracking-wider flex items-center justify-center gap-2">
                  Email Support
                </a>
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
