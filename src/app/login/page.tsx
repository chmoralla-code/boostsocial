"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Rocket, ArrowLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check query params for verification redirects
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("verified") === "true" || params.get("code")) {
        setSuccess("🎉 Email verified successfully! Your account is now fully active. Please sign in below to access your My Orders tracker workspace!");
      }
    }

    // Check if user is already logged in
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        if (data.user.email?.endsWith("@boostsocial.com")) {
          router.push("/admin");
        } else {
          router.push("/");
        }
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Automatically append @boostsocial.com if it's a simple username without @
    const loginEmail = email.includes("@") ? email.trim() : `${email.trim()}@boostsocial.com`;

    if (isSignUp) {
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify your passwords.");
        setLoading(false);
        return;
      }

      // Compute dynamic redirect URL to avoid hardcoded localhost links
      const redirectUrl = typeof window !== "undefined"
        ? `${window.location.origin}/login?verified=true`
        : "https://faceboosting.vercel.app/login?verified=true";

      // Sign Up flow with options.emailRedirectTo
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: loginEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("rate limit")) {
          setError("⚠️ Email Rate Limit Exceeded: Supabase restricts signup emails to 3 per hour by default to prevent spam. To fix this, log in to your Supabase Dashboard -> Project Settings -> Auth -> Security -> Rate Limits and increase the limit (e.g. to 30 or 50)!");
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
      } else {
        setSuccess("📬 Verification link sent! Please check your email inbox (and spam folder) to confirm your account, then sign in below.");
        setLoading(false);
        setIsSignUp(false); // Instantly return to sign in view
        setPassword("");
        setConfirmPassword("");
      }
    } else {
      // Sign In flow
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("confirm")) {
          setError("📬 Email not confirmed. Please check your email inbox and click the verification link to activate your account!");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
      } else {
        if (loginEmail.endsWith("@boostsocial.com")) {
          router.push("/admin");
        } else {
          router.push("/");
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121212] p-4 relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 pointer-events-none opacity-40"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 pointer-events-none opacity-40"></div>

      <div className="bg-[#181818] border border-slate-800/80 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
        <Link 
          href="/" 
          className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="text-[#1DB954] mb-3 drop-shadow-[0_0_10px_rgba(29,185,84,0.3)]">
            <Rocket size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Boost<span className="text-[#1DB954]">Social</span> Auth
          </h1>
          <p className="text-slate-400 text-xs mt-1 text-center">
            {isSignUp ? "Create a customer account to track orders" : "Access your amplification workspace"}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Email / Username</label>
            <input 
              type="text" 
              required
              placeholder="e.g. name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#121212] border border-slate-800/80 px-4 py-3 rounded-xl focus:outline-none focus:border-[#1DB954] text-white text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#121212] border border-slate-800/80 px-4 py-3 pr-10 rounded-xl focus:outline-none focus:border-[#1DB954] text-white text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Confirm Password</label>
              <input 
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#121212] border border-slate-800/80 px-4 py-3 rounded-xl focus:outline-none focus:border-[#1DB954] text-white text-sm transition-all"
              />
            </div>
          )}

          {error && <div className="text-red-500 text-xs font-semibold bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-left leading-relaxed">{error}</div>}
          {success && <div className="text-[#1DB954] text-xs font-semibold bg-[#1DB954]/10 border border-[#1DB954]/20 p-3.5 rounded-xl text-left leading-relaxed">{success}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-3.5 rounded-full transition-all duration-300 transform hover:scale-[1.02] flex justify-center items-center gap-2 mt-6 uppercase tracking-wider text-xs shadow-lg shadow-green-500/10 cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setSuccess("");
              setPassword("");
              setConfirmPassword("");
            }}
            className="text-xs text-[#1DB954] hover:underline font-bold cursor-pointer"
          >
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
