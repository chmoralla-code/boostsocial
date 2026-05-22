"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2, ShieldAlert, ArrowLeft, Eye, EyeOff, Lock, User, Terminal } from "lucide-react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check if user is already logged in as admin
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && data.user.email?.endsWith("@boostsocial.com")) {
        router.push("/admin");
      }
    });
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!email || !password) {
      setError("Please fill in all security fields.");
      setLoading(false);
      return;
    }

    // Automatically append @boostsocial.com if it's a simple username without @
    const loginEmail = email.includes("@") ? email.trim() : `${email.trim()}@boostsocial.com`;

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
      } else if (data.user) {
        // Enforce admin-only domain check for security!
        if (data.user.email?.endsWith("@boostsocial.com")) {
          router.push("/admin");
        } else {
          // Log out immediately if not an admin
          await supabase.auth.signOut();
          setError("🔴 Access Denied: This portal is reserved for authorized CYNETWORK administrators only.");
          setLoading(false);
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during admin authorization.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4 relative overflow-hidden">
      {/* Premium Cyberpunk Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px] -z-10 pointer-events-none"></div>
      
      {/* Technical Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none -z-10"></div>

      <div className="bg-[#121212]/90 border border-slate-800/80 p-8 rounded-2xl w-full max-w-md shadow-2xl relative transition-all duration-300 backdrop-blur-md">
        {/* Back Link */}
        <Link 
          href="/" 
          className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
        >
          <ArrowLeft size={14} /> Main Site
        </Link>

        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="text-[#1DB954] mb-4 p-3 bg-[#1DB954]/10 rounded-2xl border border-[#1DB954]/20 shadow-[0_0_20px_rgba(29,185,84,0.15)] animate-pulse">
            <Terminal size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center">
            {"CYNETWORK".split("").map((letter, idx) => (
              <span
                key={idx}
                className="inline-block transition-all duration-300 transform hover:scale-135 hover:text-[#1DB954] hover:rotate-6 hover:-translate-y-1 cursor-default select-none drop-shadow-[0_0_8px_transparent] hover:drop-shadow-[0_0_12px_rgba(29,185,84,0.6)] font-black text-white"
                style={{
                  transitionDelay: `${idx * 15}ms`
                }}
              >
                {letter}
              </span>
            ))}
          </h1>
          <div className="text-[10px] mt-2 text-[#1DB954] font-black uppercase tracking-[0.2em] bg-[#1DB954]/10 px-3 py-1 rounded-full border border-[#1DB954]/20">
            Secure Admin Portal
          </div>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 pl-1">Admin Username / Email</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <User size={16} />
              </span>
              <input 
                type="text" 
                required
                placeholder="e.g. admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-slate-800/80 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-[#1DB954] text-white text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5 pl-1">Security Keyphrase / Password</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Lock size={16} />
              </span>
              <input 
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-slate-800/80 pl-11 pr-10 py-3 rounded-xl focus:outline-none focus:border-[#1DB954] text-white text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-550 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-xs font-semibold bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-left leading-relaxed flex items-start gap-2.5 animate-shake">
              <ShieldAlert className="shrink-0 mt-0.5 text-red-500" size={16} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] flex justify-center items-center gap-2 mt-6 uppercase tracking-wider text-xs shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="animate-spin text-black" size={16} />
            ) : (
              "Authorize Access"
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          🔒 Cypher Security Protocols Active
        </div>
      </div>
    </div>
  );
}
