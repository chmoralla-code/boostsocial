import Link from 'next/link';
import { Rocket } from 'lucide-react';

export function Header() {
  return (
    <header className="w-full py-6 px-8 flex justify-between items-center max-w-7xl mx-auto border-b border-slate-800/40 relative z-50">
      <div className="flex items-center gap-2.5">
        <div className="text-[#1DB954] drop-shadow-[0_0_10px_rgba(29,185,84,0.3)]">
          <Rocket size={28} strokeWidth={2.5} />
        </div>
        <span className="text-2xl font-black tracking-tight text-white">
          Boost<span className="text-[#1DB954]">Social</span>
        </span>
      </div>
      
      <nav className="hidden md:flex gap-8 font-bold text-slate-400 text-sm">
        <Link href="#services" className="hover:text-white transition-colors">Services</Link>
        <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
        <Link href="#why-choose-us" className="hover:text-white transition-colors">Why Choose Us</Link>
        <Link href="#case-studies" className="hover:text-white transition-colors">Case Studies</Link>
      </nav>

      <button className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-2.5 px-6 rounded-full transition-all duration-300 transform hover:scale-[1.03] shadow-md shadow-green-500/10 text-xs uppercase tracking-wider">
        Get Started
      </button>
    </header>
  );
}
