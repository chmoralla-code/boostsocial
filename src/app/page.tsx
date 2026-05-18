import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ServicesSection } from "@/components/ServicesSection";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <>
      <Header />
      
      <main className="flex-grow flex flex-col items-center pt-16 relative overflow-hidden bg-[#121212] min-h-screen">
        {/* Spotify Neon Glow Backdrops */}
        <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] rounded-full spotify-glow-blob"></div>
          <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full spotify-glow-blob"></div>
          <div className="absolute top-[40%] left-[-20%] w-[500px] h-[500px] rounded-full spotify-glow-blob"></div>
        </div>

        <div className="text-center px-4 max-w-4xl mx-auto z-10">
          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-8 tracking-tighter">
            Amplify Your <br className="hidden md:inline" />
            <span className="spotify-shimmer-text">Facebook Reach</span> Instantly
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-3xl mx-auto font-semibold leading-relaxed">
            Don't worry about transparency—we deliver 50 free trial followers, <br className="hidden sm:inline" />
            reactions, or views so you can test our service before paying fully!
          </p>
          <a 
            href="#services" 
            className="inline-block bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-4 px-10 rounded-full shadow-lg shadow-green-500/10 transition-all duration-300 transform hover:scale-[1.05] tracking-wider uppercase text-xs"
          >
            Explore Services
          </a>
        </div>

        <ServicesSection services={services || []} />
      </main>

      <Footer />
    </>
  );
}
