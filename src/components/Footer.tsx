import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full py-8 text-center text-slate-500 mt-auto border-t border-border/40 bg-elevated/40 relative z-40">
      <div className="flex justify-center gap-4 text-xs font-semibold uppercase tracking-wider">
        <Link href="/" className="hover:text-[#1877F2] transition-colors">Home</Link>
        <span className="text-slate-700">|</span>
        <Link href="#services" className="hover:text-[#1877F2] transition-colors">Services</Link>
        <span className="text-slate-700">|</span>
        <Link href="#about" className="hover:text-[#1877F2] transition-colors">About</Link>
        <span className="text-slate-700">|</span>
        <Link href="#contact" className="hover:text-[#1877F2] transition-colors">Contact</Link>
      </div>
      <p className="text-[10px] text-slate-600 mt-4">
        © {new Date().getFullYear()} CYNETWORK. Powered by Spotify Design Concept. All Rights Reserved.
      </p>
    </footer>
  );
}
