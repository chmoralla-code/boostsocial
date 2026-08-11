import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full py-8 text-center text-slate-500 mt-auto border-t border-slate-800/40 bg-[#090909]/40 relative z-40">
      <div className="flex justify-center gap-4 text-xs font-semibold uppercase tracking-wider">
        <Link href="/" className="robot-link hover:text-white transition-colors">Home</Link>
        <span className="text-slate-700">|</span>
        <Link href="#services" className="robot-link hover:text-white transition-colors">Services</Link>
        <span className="text-slate-700">|</span>
        <Link href="#about" className="robot-link hover:text-white transition-colors">About</Link>
        <span className="text-slate-700">|</span>
        <Link href="#contact" className="robot-link hover:text-white transition-colors">Contact</Link>
      </div>
      <p className="mono-label text-[10px] text-slate-600 mt-4">
        © {new Date().getFullYear()} CYNETWORK. All Rights Reserved.
      </p>
    </footer>
  );
}
