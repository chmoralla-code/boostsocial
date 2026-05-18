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
      
      <main className="flex-grow flex flex-col items-center pt-16 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-[500px] overflow-hidden -z-10">
          <div className="absolute top-10 left-[10%] w-6 h-6 rounded-full bg-orange-100 opacity-50"></div>
          <div className="absolute top-40 right-[15%] w-12 h-12 border-2 border-blue-100 rounded-lg transform rotate-12"></div>
          <div className="absolute top-[40%] left-[5%] w-16 h-16 rounded-full bg-orange-200 blur-xl opacity-40"></div>
          <div className="absolute top-20 right-[5%] w-8 h-8 rounded-full bg-orange-100 opacity-60"></div>
          <div className="absolute top-60 left-[20%] w-4 h-4 border border-blue-200 transform rotate-45"></div>
        </div>

        <div className="text-center px-4 max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-extrabold text-[#0f172a] leading-tight mb-6 tracking-tight">
            Amplify Your Facebook<br/>Reach Instantly
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto font-medium">
            Gain Genuine Followers, Reactions, and Views.<br/>
            Boost Your Profile & Pages Fast & Safely.
          </p>
          <a href="#services" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-lg shadow-lg shadow-blue-600/30 transition-all hover:scale-105">
            ORDER NOW
          </a>
        </div>

        <ServicesSection services={services || []} />
      </main>

      <Footer />
    </>
  );
}
