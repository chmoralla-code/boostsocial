import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ServicesSection } from "@/components/ServicesSection";
import { createClient } from "@/utils/supabase/server";
import { Download, Shield, Zap, Star, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: true });

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

  return (
    <>
      <Header />
      
      <main className="flex-grow flex flex-col items-center pt-8 sm:pt-14 md:pt-24 relative overflow-x-hidden bg-bg min-h-screen">
        {/* Futuristic Technical Grid Backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none -z-10 light-mode:bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)]"></div>
        
        {/* 🌌 Galaxy Dark Red Ambient Glow Backdrops */}
        <div className="absolute top-0 left-0 w-full h-[700px] overflow-hidden z-[1] pointer-events-none">
          <div className="absolute top-[-25%] left-[8%] w-[600px] h-[600px] rounded-full fb-glow-blob opacity-80"></div>
          <div className="absolute top-[15%] right-[-12%] w-[700px] h-[700px] rounded-full galaxy-glow-blob opacity-80"></div>
          <div className="absolute top-[35%] left-[-15%] w-[600px] h-[600px] rounded-full galaxy-glow-blob opacity-80"></div>
        </div>

        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 md:px-8 z-10 flex flex-col items-center text-center pt-5 sm:pt-8 pb-8 sm:pb-10">
          {/* Animated Tech Badge */}
          <div className="robot-hud inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] sm:text-xs font-black tracking-widest text-primary mb-5 sm:mb-6 uppercase shadow-xl backdrop-blur-md animate-fade-in-up-1 text-center light-mode:bg-slate-100/50 light-mode:border-slate-200/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-dark opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="mono-label">📱 Official Mobile App</span>
          </div>

          <h1 className="text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.02] sm:leading-[1.05] mb-5 sm:mb-6 tracking-normal uppercase animate-fade-in-up-2 text-fg">
            <span className="robot-glitch">Boost Your Social Media</span> <br className="hidden md:inline" />
            <span className="fb-shimmer-text">Anywhere, Anytime</span>
          </h1>
          

          {/* APK Download + Browse Services Buttons */}
          <div className="animate-fade-in-up-3 mb-4 sm:mb-6 flex flex-col sm:flex-row items-center gap-3">
            <a 
              href="/downloads/pinoyboosting.apk" 
              download
              className="robot-btn group relative inline-flex items-center justify-center gap-3 px-8 sm:px-14 py-5 sm:py-7 rounded-2xl bg-gradient-to-r from-white to-[#d4d4d8] text-black font-black text-base sm:text-xl uppercase tracking-wider shadow-2xl hover:shadow-white/40 transform hover:scale-105 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
              <Download size={26} className="relative z-10" />
              <span className="relative z-10">Download APK Free</span>
            </a>
            <a 
              href="#services" 
              className="robot-btn group relative inline-flex items-center justify-center gap-2 px-8 sm:px-10 py-5 sm:py-7 rounded-2xl border-2 border-white/20 bg-white/[0.03] text-white font-black text-base sm:text-xl uppercase tracking-wider shadow-xl hover:border-primary/50 hover:bg-white/[0.06] transform hover:scale-105 transition-all duration-300 backdrop-blur-sm"
            >
              <Layers size={24} className="relative z-10 text-primary" />
              <span className="relative z-10">Browse Services</span>
            </a>
          </div>

          {/* Persuasive caption */}
          <p className="text-[11px] sm:text-xs text-muted mb-8 sm:mb-10 max-w-md font-semibold leading-relaxed animate-fade-in-up-3">
            <span className="mono-label text-fg">▸ 8,200+ Filipinos</span> already downloaded this month. <br className="hidden sm:inline" />
            Works on Android 7.0+ • No ads • No tracking • ~12 MB
          </p>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 w-full max-w-3xl animate-fade-in-up-3">
            <div className="robot-hud flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm light-mode:bg-slate-100/50 light-mode:border-slate-200/50">
              <Shield size={22} className="text-primary shrink-0" />
              <div className="text-left">
                <div className="text-[11px] font-black text-fg uppercase tracking-wider">100% Safe</div>
                <div className="text-[10px] text-muted">No password needed</div>
              </div>
            </div>
            <div className="robot-hud flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm light-mode:bg-slate-100/50 light-mode:border-slate-200/50">
              <Zap size={22} className="text-primary shrink-0" />
              <div className="text-left">
                <div className="text-[11px] font-black text-fg uppercase tracking-wider">Instant Start</div>
                <div className="text-[10px] text-muted">5-15 min delivery</div>
              </div>
            </div>
            <div className="robot-hud flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm light-mode:bg-slate-100/50 light-mode:border-slate-200/50">
              <Star size={22} className="text-primary shrink-0" />
              <div className="text-left">
                <div className="text-[11px] font-black text-fg uppercase tracking-wider">99.8% Happy</div>
                <div className="text-[10px] text-muted">8.9M+ boosts delivered</div>
              </div>
            </div>
          </div>
        </div>

        <ServicesSection services={services || []} servicesBg={servicesBg} servicesCandidates={servicesCandidates} />

        {/* 📬 Contact & Support */}
        <section id="contact" className="w-full max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-16 border-t border-border/40 relative z-10">
          <div className="robot-hud rounded-[2rem] bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative text-center light-mode:bg-slate-50/50 light-mode:border-slate-200/50">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <h3 className="text-lg sm:text-xl font-black text-fg uppercase mb-2 tracking-tight">📬 Need Help?</h3>
            <p className="text-muted text-xs mb-5">Email our support team — we reply within hours.</p>
            <a 
              href="mailto:support@cynetwork.ph" 
              className="robot-btn inline-block bg-white hover:bg-[#d4d4d8] text-black font-extrabold py-3 px-8 rounded-full transition-all duration-300 uppercase text-xs tracking-wider"
            >
              support@cynetwork.ph
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
