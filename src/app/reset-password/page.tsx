"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  // Password strength checklist metrics
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  
  const metCount = [hasMinLength, hasUppercase, hasNumber, hasSpecialChar].filter(Boolean).length;
  
  const getStrengthLabel = () => {
    if (password.length === 0) return { label: "", color: "bg-slate-800", text: "text-slate-500", width: "w-0" };
    if (metCount <= 1) return { label: "Weak ⚠️", color: "bg-red-500 shadow-red-500/20", text: "text-red-400", width: "w-1/4" };
    if (metCount === 2) return { label: "Fair 😐", color: "bg-orange-500 shadow-orange-500/20", text: "text-orange-400", width: "w-1/2" };
    if (metCount === 3) return { label: "Good 👍", color: "bg-yellow-500 shadow-yellow-500/20", text: "text-yellow-400", width: "w-3/4" };
    return { label: "Strong! 💪", color: "bg-[#1DB954] shadow-green-500/20", text: "text-[#1DB954]", width: "w-full" };
  };

  const strength = getStrengthLabel();

  useEffect(() => {
    // 1. Confirm user has an active session from the recovery callback link
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setIsAuthenticated(true);
        if (data.user.email?.endsWith("@boostsocial.com")) {
          setIsAdmin(true);
        }
      } else {
        setIsAuthenticated(false);
      }
      setVerifyingSession(false);
    });
  }, []);

  // Handle countdown and auto redirect on success
  useEffect(() => {
    if (success && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (success && countdown === 0) {
      router.push(isAdmin ? "/admin" : "/");
    }
  }, [success, countdown, router, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify your entries.");
      setLoading(false);
      return;
    }

    if (metCount < 3) {
      setError("Please choose a stronger password matching at least 3 security criteria.");
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
      } else {
        setSuccess(true);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during password update.");
      setLoading(false);
    }
  };

  if (verifyingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#121212] text-white">
        <Loader2 className="animate-spin text-[#1DB954] mb-3" size={40} />
        <p className="text-slate-400 text-sm font-semibold tracking-wider uppercase animate-pulse">
          Authorizing Recovery Session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] p-4 relative overflow-hidden">
        {/* Glow Backdrops */}
        <div className="absolute top-[-10%] left-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 opacity-30"></div>
        <div className="absolute bottom-[-10%] right-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 opacity-30"></div>

        <div className="bg-[#181818] border border-slate-800/80 p-8 rounded-2xl w-full max-w-md shadow-2xl text-center">
          <div className="text-red-500 mx-auto w-fit mb-4 p-3 bg-red-500/10 rounded-full border border-red-500/20">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">Unauthorized Session</h2>
          <p className="text-slate-400 text-xs mt-2.5 leading-relaxed max-w-sm mx-auto">
            You don't have an active recovery session. If you clicked a password reset link, it may have expired or already been used. Please request a new recovery link!
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-block bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-3 px-8 rounded-full transition-all duration-300 transform hover:scale-[1.03] uppercase tracking-wider text-xs shadow-lg shadow-green-500/10"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121212] p-4 relative overflow-hidden">
      {/* Radial Backdrops */}
      <div className="absolute top-[-10%] left-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 pointer-events-none opacity-40"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 pointer-events-none opacity-40"></div>

      <div className="bg-[#181818] border border-slate-800/80 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
        {success ? (
          <div className="flex flex-col items-center text-center py-6">
            <div className="text-[#1DB954] mb-4 bg-green-500/10 p-3 rounded-full border border-green-500/20 animate-bounce">
              <CheckCircle2 size={48} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Password Reset Complete!</h1>
            <p className="text-slate-400 text-xs mt-2 max-w-xs mx-auto leading-relaxed">
              Your password has been securely updated. You will be redirected to your dashboard workspace in:
            </p>
            <div className="text-4xl font-black text-[#1DB954] my-6 bg-[#121212] border border-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg">
              {countdown}
            </div>
            <button
              onClick={() => router.push(isAdmin ? "/admin" : "/")}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-3 rounded-full transition-all duration-300 uppercase tracking-wider text-xs shadow-lg cursor-pointer"
            >
              Continue to Workspace Now
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-6">
              <div className="text-[#1DB954] mb-3 bg-[#1DB954]/10 p-3 rounded-full border border-[#1DB954]/20">
                <KeyRound size={32} strokeWidth={2.5} />
              </div>
              <h1 className="text-xl font-black text-white tracking-tight">Reset Password</h1>
              <p className="text-slate-400 text-xs mt-1 text-center">
                Configure a secure new password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">New Password</label>
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

              {/* Password Strength HUD */}
              {password.length > 0 && (
                <div className="bg-[#121212] border border-slate-800/80 p-3.5 rounded-xl space-y-2.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-slate-400">Password Strength:</span>
                    <span className={strength.text}>{strength.label}</span>
                  </div>
                  {/* Strength Bar */}
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300 rounded-full`}></div>
                  </div>
                  {/* Checklist */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] font-semibold">
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-[#1DB954]" : "text-slate-500"}`}>
                      <CheckCircle2 size={10} /> 8+ Characters
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-[#1DB954]" : "text-slate-500"}`}>
                      <CheckCircle2 size={10} /> Uppercase Letter
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? "text-[#1DB954]" : "text-slate-500"}`}>
                      <CheckCircle2 size={10} /> Has Number
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasSpecialChar ? "text-[#1DB954]" : "text-slate-500"}`}>
                      <CheckCircle2 size={10} /> Special Symbol
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-red-500 text-xs font-semibold bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-left leading-relaxed flex items-start gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-black py-3.5 rounded-full transition-all duration-300 transform hover:scale-[1.02] flex justify-center items-center gap-2 mt-6 uppercase tracking-wider text-xs shadow-lg shadow-green-500/10 cursor-pointer"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : "Update Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
