import Link from 'next/link';
import { Rocket } from 'lucide-react';

export function Header() {
  return (
    <header className="w-full py-6 px-8 flex justify-between items-center max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="text-blue-600">
           <Rocket size={32} strokeWidth={2} />
        </div>
        <span className="text-2xl font-bold tracking-tight text-slate-900">BoostSocial</span>
      </div>
      
      <nav className="hidden md:flex gap-8 font-semibold text-slate-800 text-sm">
        <Link href="#services" className="hover:text-blue-600 transition-colors">Services</Link>
        <Link href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
        <Link href="#why-choose-us" className="hover:text-blue-600 transition-colors">Why Choose Us</Link>
        <Link href="#case-studies" className="hover:text-blue-600 transition-colors">Case Studies</Link>
      </nav>

      <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors">
        Get Started
      </button>
    </header>
  );
}
