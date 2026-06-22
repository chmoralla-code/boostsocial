export default function EmailConfirmedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121212] p-4 relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 pointer-events-none opacity-40"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 pointer-events-none opacity-40"></div>

      <div className="bg-[#181818] border border-slate-800/80 p-10 rounded-2xl w-full max-w-md shadow-2xl text-center">
        {/* Success icon */}
        <div className="w-16 h-16 bg-[#1877F2]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[#1877F2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h1 className="text-2xl font-black text-white tracking-tight mb-3">
          Email Successfully <span className="text-[#1877F2]">Registered!</span>
        </h1>
        
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          Enjoy the services! 🚀
        </p>

        <a
          href="/login"
          className="inline-block w-full bg-[#1877F2] hover:bg-[#4e8df5] text-white font-black py-3.5 rounded-full transition-all duration-300 text-xs uppercase tracking-wider shadow-lg shadow-blue-500/10 text-center"
        >
          Go to Sign In →
        </a>
      </div>
    </div>
  );
}
