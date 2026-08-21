import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full mt-auto border-t border-slate-800/40 bg-[#090909]/60 relative z-40 light-mode:bg-slate-50 light-mode:border-slate-200">
      {/* Top glow line */}
      <div
        aria-hidden="true"
        className="absolute -top-px left-1/2 -translate-x-1/2 w-2/3 max-w-2xl h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none"
      ></div>

      <div className="max-w-5xl mx-auto px-6 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 text-center sm:text-left" data-reveal>
          {/* Brand */}
          <div>
            <div className="font-black uppercase tracking-widest text-sm text-slate-200 light-mode:text-slate-800">
              Pinoy<span className="text-primary">Boosting</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed font-semibold max-w-[26ch] mx-auto sm:mx-0 light-mode:text-slate-500">
              Boost your social media anywhere, anytime. Built for Filipinos, powered by GCash.
            </p>
            <div className="mono-label text-[9px] text-slate-500 mt-4 inline-flex items-center gap-2 light-mode:text-slate-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              ALL SYSTEMS OPERATIONAL<span className="robot-cursor">_</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <div className="mono-label text-[9px] text-slate-600 mb-3 uppercase tracking-[0.3em] light-mode:text-slate-500">
              // Navigate
            </div>
            <nav className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wider">
              <div className="flex sm:justify-start justify-center gap-x-6 gap-y-2 flex-wrap">
                <Link href="/" className="robot-link hover:text-white transition-colors text-slate-400 light-mode:text-slate-600">Home</Link>
                <Link href="#services" className="robot-link hover:text-white transition-colors text-slate-400 light-mode:text-slate-600">Services</Link>
              </div>
              <div className="flex sm:justify-start justify-center gap-x-6 gap-y-2 flex-wrap">
                <Link href="/track" className="robot-link hover:text-white transition-colors text-slate-400 light-mode:text-slate-600">Track Order</Link>
                <Link href="/vip" className="robot-link hover:text-white transition-colors text-slate-400 light-mode:text-slate-600">VIP</Link>
              </div>
              <div className="flex sm:justify-start justify-center gap-x-6 gap-y-2 flex-wrap">
                <Link href="/affiliate" className="robot-link hover:text-white transition-colors text-slate-400 light-mode:text-slate-600">Affiliate</Link>
                <Link href="#contact" className="robot-link hover:text-white transition-colors text-slate-400 light-mode:text-slate-600">Contact</Link>
              </div>
            </nav>
          </div>

          {/* Support */}
          <div>
            <div className="mono-label text-[9px] text-slate-600 mb-3 uppercase tracking-[0.3em] light-mode:text-slate-500">
              // Support
            </div>
            <div className="flex flex-col gap-2 text-xs text-slate-500 font-semibold light-mode:text-slate-600">
              <a href="mailto:support@cynetwork.ph" className="robot-link hover:text-white transition-colors w-fit mx-auto sm:mx-0 light-mode:hover:text-slate-900">
                support@cynetwork.ph
              </a>
              <span className="text-slate-600 light-mode:text-slate-500">Replies within hours</span>
              <span className="mono-label text-[10px] text-slate-500 mt-1 light-mode:text-slate-600">
                ▸ GCash · Maya Accepted
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800/40 mt-8 pt-5 text-center light-mode:border-slate-200">
          <p className="mono-label text-[10px] text-slate-600 light-mode:text-slate-500">
            © {year} CYNETWORK. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  );
}
