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
      
      <main className="flex-grow flex flex-col items-center pt-8 sm:pt-14 md:pt-24 relative overflow-hidden bg-[#0a0a0a] min-h-screen">
        {/* Video Background */}
        <HeroVideoBackground videoUrl={videoUrl} opacity={opacity} />
        
        {/* Futuristic Technical Grid Backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none -z-10"></div>
        
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
            <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] sm:text-xs font-black tracking-widest text-[#1DB954] mb-5 sm:mb-6 uppercase shadow-xl shadow-emerald-500/5 backdrop-blur-md animate-fade-in-up-1 text-center">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1ed760] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DB954]"></span>
              </span>
              {heroTexts.badge}
            </div>

            <h1 className="text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.02] sm:leading-[1.05] mb-5 sm:mb-6 tracking-normal uppercase animate-fade-in-up-2">
              {parseTitle(heroTexts.title)}
            </h1>
            
            <p className="text-sm sm:text-base md:text-lg text-slate-400 mb-7 sm:mb-10 max-w-xl font-bold leading-relaxed animate-fade-in-up-3">
              {parseDescriptionText(heroTexts.description)}
            </p>
            
            <div className="w-full max-w-xl animate-fade-in-up-3 mb-8 sm:mb-10">
              <HeroSearch services={services || []} />
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
      </main>

      <Footer />
    </>
  );
}
