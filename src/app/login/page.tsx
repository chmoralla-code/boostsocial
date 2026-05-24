"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Rocket, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle, Sparkles, MailCheck } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  
  // Real-time email validation states
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailVerifiedDetails, setEmailVerifiedDetails] = useState<{ isGoogle?: boolean; serviceProvider?: string } | null>(null);

  // Forgot password countdown state
  const [resendCountdown, setResendCountdown] = useState(0);

  const router = useRouter();
  const supabase = createClient();

  // Password strength checklist metrics (only shown on signup)
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
    return { label: "Strong! 💪", color: "bg-[#1877F2] shadow-blue-500/20", text: "text-[#1877F2]", width: "w-full" };
  };

  const strength = getStrengthLabel();

  useEffect(() => {
    // 1. Check LocalStorage for "Remember Me" credentials
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("boostsocial_remember_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
      
      // Parse query params for verification/referral redirects
      const params = new URLSearchParams(window.location.search);
      const verified = params.get("verified");
      const code = params.get("code");
      const ref = params.get("ref");
      const errParam = params.get("error");

      if (verified === "true" || code) {
        setSuccess("✨ Account Successfully Activated! Your email has been verified. Welcome to your CYNETWORK workspace! Please sign in below to manage your services and track your orders in real time. 🚀");
      }
      if (errParam) {
        setError(decodeURIComponent(errParam));
      }
      if (ref) {
        setReferralCode(ref);
        setMode("signup");
      }
    }

    // 2. Check if user is already logged in
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

  // Countdown timer for password reset resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Automatically append @boostsocial.com if it's a simple username without @
    const loginEmail = (email.includes("@") ? email.trim() : `${email.trim()}@boostsocial.com`).toLowerCase();

    // A. Signup Flow
    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify your passwords.");
        setLoading(false);
        return;
      }

      if (metCount < 3) {
        setError("Please choose a stronger password matching at least 3 security criteria.");
        setLoading(false);
        return;
      }

      // 1. Call real-time email verifier endpoint
      setEmailVerifying(true);
      try {
        const verifyRes = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginEmail })
        });
        const verifyData = await verifyRes.json();
        setEmailVerifying(false);

        if (!verifyData.valid) {
          setError(verifyData.error || "Email verification failed.");
          setLoading(false);
          return;
        }

        // Keep track of domain details for UI highlights
        setEmailVerifiedDetails({
          isGoogle: verifyData.isGoogle,
          serviceProvider: verifyData.serviceProvider
        });
      } catch (dnsErr) {
        console.warn("DNS verifier network error - degrading gracefully:", dnsErr);
        setEmailVerifying(false);
      }

      // 2. Proceed to write to the secure database and createUser endpoint
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginEmail, password, referralCode: referralCode.trim() })
        });

        const resData = await res.json();

        if (!res.ok) {
          setError(resData.error || "Failed to create account.");
          setLoading(false);
        } else {
          setSuccess("📬 Registration Successful! We have sent a verification link to your email. Please check your inbox (and spam/junk folder) and click the link to activate your wallet before signing in! 🚀");
          setLoading(false);
          setMode("signin"); // Go straight to Sign In
          setPassword("");
          setConfirmPassword("");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred during registration.");
        setLoading(false);
      }

    // B. Forgot Password Flow
    } else if (mode === "forgot") {
      if (resendCountdown > 0) {
        setError(`Please wait ${resendCountdown} seconds before requesting another recovery email.`);
        setLoading(false);
        return;
      }

      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(loginEmail, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
        });

        if (resetError) {
          setError(resetError.message);
          setLoading(false);
        } else {
          setSuccess(`📬 Password recovery email sent! Check your inbox (and spam/junk folder) at ${loginEmail} for the recovery link to create a new password. 🚀`);
          setResendCountdown(60); // Protect against API rate limits and spamming
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message || "Failed to request password reset. Please try again later.");
        setLoading(false);
      }

    // C. Sign In Flow
    } else {
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
        // Handle "Remember Me" credentials storage
        if (typeof window !== "undefined") {
          if (rememberMe) {
            localStorage.setItem("boostsocial_remember_email", email.trim());
          } else {
            localStorage.removeItem("boostsocial_remember_email");
          }
        }

        if (loginEmail.endsWith("@boostsocial.com")) {
          router.push("/admin");
        } else {
          router.push("/");
        }
      }
    }
  };

  const switchMode = (newMode: "signin" | "signup" | "forgot") => {
    setMode(newMode);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
    setEmailVerifiedDetails(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121212] p-4 relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 pointer-events-none opacity-40"></div>
      <div className="absolute bottom-[-10%] right-[10%] w-[300px] h-[300px] rounded-full spotify-glow-blob -z-10 pointer-events-none opacity-40"></div>

      <div className="bg-[#181818] border border-slate-800/80 p-8 rounded-2xl w-full max-w-md shadow-2xl relative transition-all duration-300">
        <Link 
          href="/" 
          className="absolute top-6 left-6 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="text-[#1877F2] mb-3 drop-shadow-[0_0_10px_rgba(29,185,84,0.3)] animate-pulse">
            <Rocket size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center">
            {"CYNETWORK".split("").map((letter, idx) => (
              <span
                key={idx}
                className="inline-block transition-all duration-300 transform hover:scale-135 hover:text-[#1877F2] hover:rotate-6 hover:-translate-y-1 cursor-default select-none drop-shadow-[0_0_8px_transparent] hover:drop-shadow-[0_0_12px_rgba(24,119,242,0.6)] font-black"
                style={{
                  transitionDelay: `${idx * 15}ms`
                }}
              >
                {letter}
              </span>
            ))}
            <span className="text-slate-400 font-semibold ml-2 text-xl font-sans tracking-normal">Auth</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1.5 text-center px-4 leading-relaxed">
            {mode === "signup" && "Create a customer account to track orders & claim your ₱20 welcome bonus"}
            {mode === "signin" && "Access your amplification workspace & realtime tracking console"}
            {mode === "forgot" && "Reset your lost credentials securely using email validation"}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400">Email / Username</label>
              {mode === "signup" && emailVerifiedDetails?.isGoogle && (
                <span className="text-[10px] text-[#1877F2] font-black uppercase tracking-wider flex items-center gap-1 bg-[#1877F2]/10 px-2 py-0.5 rounded-md border border-[#1877F2]/20 animate-bounce">
                  <Sparkles size={8} /> Google Verified
                </span>
              )}
            </div>
            <input 
              type="text" 
              required
              placeholder="e.g. name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#121212] border border-slate-800/80 px-4 py-3 rounded-xl focus:outline-none focus:border-[#1877F2] text-white text-sm transition-all"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#121212] border border-slate-800/80 px-4 py-3 pr-10 rounded-xl focus:outline-none focus:border-[#1877F2] text-white text-sm transition-all"
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
          )}

          {mode === "signup" && (
            <>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Confirm Password</label>
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#121212] border border-slate-800/80 px-4 py-3 rounded-xl focus:outline-none focus:border-[#1877F2] text-white text-sm transition-all"
                />
              </div>

              {/* Password Strength Checklist HUD */}
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
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-[#1877F2]" : "text-slate-500"}`}>
                      <CheckCircle2 size={10} /> 8+ Characters
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-[#1877F2]" : "text-slate-500"}`}>
                      <CheckCircle2 size={10} /> Uppercase Letter
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? "text-[#1877F2]" : "text-slate-500"}`}>
                      <CheckCircle2 size={10} /> Has Number
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasSpecialChar ? "text-[#1877F2]" : "text-slate-500"}`}>
                      <CheckCircle2 size={10} /> Special Symbol
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Referral Code (Optional)</label>
                <input 
                  type="text"
                  placeholder="e.g. REF-12345678"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="w-full bg-[#121212] border border-slate-800/80 px-4 py-3 rounded-xl focus:outline-none focus:border-[#1877F2] text-white text-sm transition-all font-mono"
                />
              </div>
            </>
          )}

          {/* Remember Me and Forgot Password bar */}
          {mode === "signin" && (
            <div className="flex justify-between items-center text-xs font-bold pt-1">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer hover:text-white select-none">
                <input 
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-[#121212] border-slate-800 text-[#1877F2] focus:ring-[#1877F2] accent-[#1877F2]"
                />
                Remember Me
              </label>
              <button 
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-[#1877F2] hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {error && (
            <div className="text-red-500 text-xs font-semibold bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-left leading-relaxed flex items-start gap-2 animate-shake">
              <AlertCircle className="shrink-0 mt-0.5" size={14} />
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="text-[#1877F2] text-xs font-semibold bg-[#1877F2]/10 border border-[#1877F2]/20 p-3.5 rounded-xl text-left leading-relaxed flex items-start gap-2">
              <MailCheck className="shrink-0 mt-0.5" size={14} />
              <span>{success}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || emailVerifying}
            className="w-full bg-[#1877F2] hover:bg-[#4e8df5] text-white font-black py-3.5 rounded-full transition-all duration-300 transform hover:scale-[1.02] flex justify-center items-center gap-2 mt-6 uppercase tracking-wider text-xs shadow-lg shadow-blue-500/10 cursor-pointer animate-fade-in"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : emailVerifying ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Checking Mail Domain...
              </>
            ) : (
              <>
                {mode === "signup" && "Create Account"}
                {mode === "signin" && "Sign In"}
                {mode === "forgot" && (resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Send Recovery Link")}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800/80 text-center flex flex-col gap-3">
          {mode === "forgot" ? (
            <button 
              onClick={() => switchMode("signin")}
              className="text-xs text-[#1877F2] hover:underline font-bold cursor-pointer"
            >
              Back to Sign In
            </button>
          ) : (
            <button 
              onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
              className="text-xs text-[#1877F2] hover:underline font-bold cursor-pointer"
            >
              {mode === "signup" ? "Already have an account? Sign In" : "Don't have an account? Create one"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
