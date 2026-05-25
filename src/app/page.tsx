import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ServicesSection } from "@/components/ServicesSection";
import { HeroVideoBackground } from "@/components/HeroVideoBackground";
import { createClient } from "@/utils/supabase/server";
import { parseDescription } from "@/utils/serviceHelpers";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: true });

  // Fetch custom hero video URL and opacity from Supabase Storage config
  let videoUrl = "";
  let opacity = 0.45;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const configUrl = `${supabaseUrl}/storage/v1/object/public/receipts/admin-config/hero-video.png`;
      const res = await fetch(configUrl, { cache: "no-store" });
      if (res.ok) {
        const config = await res.json();
        videoUrl = config.videoUrl || "";
        opacity = config.opacity !== undefined ? Number(config.opacity) : 0.45;
      }
    }
  } catch (err) {
    console.error("Failed to load custom hero video configuration:", err);
  }

  return (
    <>
      <Header />
      
      <main className="flex-grow flex flex-col items-center pt-24 relative overflow-hidden bg-[#0a0a0a] min-h-screen">
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

        <div className="text-center px-4 max-w-4xl mx-auto z-10 flex flex-col items-center">
          {/* Animated Tech Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] sm:text-xs font-black tracking-widest text-[#1DB954] mb-8 uppercase shadow-xl shadow-emerald-500/5 backdrop-blur-md animate-fade-in-up-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1ed760] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DB954]"></span>
            </span>
            ⚡ Next-Gen Amplification Engine
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-none mb-6 tracking-tighter uppercase animate-fade-in-up-2">
            MAS BARATO PA SA <br className="hidden md:inline" />
            <span className="fb-shimmer-text">FACEBOOK</span> <span className="spotify-shimmer-text">BOOSTING</span> SERVICES !
          </h1>
          
          <p className="text-sm sm:text-base md:text-lg text-slate-400 mb-12 max-w-2xl mx-auto font-bold leading-relaxed animate-fade-in-up-3">
            Don't worry about transparency—we deliver <span className="text-white">50 free trial</span> followers, <br className="hidden sm:inline" />
            reactions, or views so you can test our service before paying fully!
          </p>
          
          <a 
            href="#services" 
            className="inline-block bg-[#1877F2] hover:bg-[#4e8df5] text-white font-black py-4.5 px-12 rounded-full shadow-[0_0_30px_rgba(24,119,242,0.35)] hover:shadow-[0_0_45px_rgba(24,119,242,0.55)] transition-all duration-300 transform hover:scale-[1.04] tracking-widest uppercase text-xs border border-blue-400/20 cursor-pointer animate-fade-in-up-3 mb-10"
          >
            Explore Services
          </a>

          {/* Value Propositions / Trust Highlights to beat automated faceless panels */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-3xl w-full mt-2 animate-fade-in-up-3">
            <div className="bg-white/[0.02] border border-white/[0.04] backdrop-blur-md rounded-2xl p-4 flex flex-col items-center text-center justify-center group hover:border-[#1DB954]/20 transition-all duration-300">
              <span className="text-xl sm:text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-300">🛡️</span>
              <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">Monetization Safe</span>
              <span className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">Filtered Ad-compliant pools</span>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] backdrop-blur-md rounded-2xl p-4 flex flex-col items-center text-center justify-center group hover:border-[#1877F2]/20 transition-all duration-300">
              <span className="text-xl sm:text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-300">🇵🇭</span>
              <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">PH Base Curation</span>
              <span className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">Organic local profiles</span>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] backdrop-blur-md rounded-2xl p-4 flex flex-col items-center text-center justify-center group hover:border-[#1DB954]/20 transition-all duration-300">
              <span className="text-xl sm:text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-300">💬</span>
              <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">Taglish Handshake</span>
              <span className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">24h developer-direct assistance</span>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] backdrop-blur-md rounded-2xl p-4 flex flex-col items-center text-center justify-center group hover:border-[#1877F2]/20 transition-all duration-300">
              <span className="text-xl sm:text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-300">📲</span>
              <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">GCash Auto-Verify</span>
              <span className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">No crypto payment hassle</span>
            </div>
          </div>
        </div>

        <ServicesSection services={services || []} />
      </main>

      <Footer />
    </>
  );
}
