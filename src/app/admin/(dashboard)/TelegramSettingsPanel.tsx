"use client";

import { useState, useEffect } from "react";
import { Bot, Send, CheckCircle, XCircle, Loader2, Save } from "lucide-react";

export function TelegramSettingsPanel() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load saved config on mount
  useEffect(() => {
    fetch("/api/admin/telegram-settings")
      .then((r) => r.json())
      .then((data) => {
        setBotToken(data.bot_token || "");
        setChatId(data.chat_id || "");
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setSaveResult({ success: false, message: "Please fill in both fields before saving." });
      return;
    }
    setIsSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/admin/telegram-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken.trim(), chat_id: chatId.trim() }),
      });
      const data = await res.json();
      setSaveResult({
        success: res.ok,
        message: res.ok ? "✅ Settings saved! They will persist across refreshes." : `❌ ${data.error}`,
      });
    } catch {
      setSaveResult({ success: false, message: "❌ Failed to save. Check your connection." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setTestResult({ success: false, message: "Save your settings first before testing." });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/telegram-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken.trim(), chat_id: chatId.trim() }),
      });
      const data = await res.json();
      setTestResult({
        success: res.ok,
        message: res.ok
          ? "✅ Test message sent! Check your Telegram."
          : `❌ ${data.error} — Make sure you messaged your bot first, and Chat ID is correct.`,
      });
    } catch {
      setTestResult({ success: false, message: "❌ Connection error." });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#181818] rounded-2xl border border-slate-850/85 p-6 flex items-center gap-3 mt-6">
        <Loader2 className="animate-spin text-[#1DB954]" size={20} />
        <span className="text-xs text-slate-400 font-semibold">Loading Telegram settings...</span>
      </div>
    );
  }

  const isConfigured = botToken.trim() && chatId.trim();

  return (
    <div className="bg-[#181818] rounded-2xl border border-slate-850/80 p-6 mt-6 relative overflow-hidden text-white shadow-md">
      {/* Soft decorative glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-850/60">
        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
          <Bot size={20} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Telegram Order Notifications
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
              isConfigured
                ? "bg-green-550/10 text-[#1DB954] border-green-500/20"
                : "bg-orange-550/10 text-orange-400 border-orange-500/20"
            }`}>
              {isConfigured ? "● Active" : "○ Not Configured"}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">
            Get instant Telegram alerts when a customer places an order.
          </p>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-[#121212]/80 border border-slate-850 rounded-xl p-4 mb-5 text-xs space-y-2 text-slate-400">
        <p className="font-black text-blue-400 uppercase tracking-wide text-[10px] mb-2">📖 How to get your credentials</p>
        <p className="leading-relaxed">
          <span className="font-bold text-slate-300">1. Bot Token:</span> Open Telegram → search{" "}
          <span className="font-mono font-bold text-blue-400 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">@BotFather</span> → type{" "}
          <span className="font-mono bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-blue-400">/newbot</span> → follow the steps → copy the <strong>token</strong> it gives you.
        </p>
        <p className="leading-relaxed">
          <span className="font-bold text-slate-300">2. Chat ID (easiest way):</span> Open Telegram → search{" "}
          <span className="font-mono font-bold text-blue-400 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">@Intergram_Bot</span> → press <strong>Start</strong>.{" "}
          It will instantly reply with your <strong>Chat ID</strong> number. Copy it.
        </p>
        <p className="leading-relaxed">
          <span className="font-bold text-slate-300">3. Authorize your bot:</span> Search your own bot by username → press <strong>Start</strong> on it too. This allows the bot to message you.
        </p>
        <p className="leading-relaxed">
          <span className="font-bold text-slate-300">4.</span> Paste both below → <strong>Save Settings</strong> → <strong>Test Bot</strong>.
        </p>
      </div>

      {/* Inputs */}
      <div className="space-y-4 mb-5">
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            🤖 BotFather Token
          </label>
          <input
            type="text"
            value={botToken}
            onChange={(e) => { setBotToken(e.target.value); setSaveResult(null); }}
            className="w-full px-4 py-3 rounded-xl bg-[#121212]/60 border border-slate-850 focus:outline-none focus:ring-2 focus:ring-[#1DB954]/50 focus:border-[#1DB954] text-white text-xs font-mono transition-all placeholder:text-slate-600"
            placeholder="1234567890:ABCdefGHIjklmNoPQRsTUVwXYZ..."
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
            💬 Chat ID <span className="text-blue-450 font-normal normal-case tracking-normal">(from @Intergram_Bot)</span>
          </label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => { setChatId(e.target.value); setSaveResult(null); }}
            className="w-full px-4 py-3 rounded-xl bg-[#121212]/60 border border-slate-850 focus:outline-none focus:ring-2 focus:ring-[#1DB954]/50 focus:border-[#1DB954] text-white text-xs font-mono transition-all placeholder:text-slate-650"
            placeholder="e.g. 5144639792"
          />
          <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">
            Get this by messaging <span className="font-mono font-bold text-blue-400">@Intergram_Bot</span> on Telegram — it replies with your ID instantly.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-550 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin text-black" /> : <Save size={14} />}
          {isSaving ? "Saving..." : "Save Settings"}
        </button>

        <button
          onClick={handleTest}
          disabled={isTesting}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
        >
          {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isTesting ? "Sending Test..." : "Test Bot"}
        </button>
      </div>

      {/* Feedback */}
      {saveResult && (
        <div className={`mt-4 border p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200 ${
          saveResult.success 
            ? "bg-green-500/10 border-green-500/20 text-emerald-400" 
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {saveResult.success ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" /> : <XCircle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />}
          <span>{saveResult.message}</span>
        </div>
      )}
      {testResult && (
        <div className={`mt-3 border p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200 ${
          testResult.success 
            ? "bg-green-500/10 border-green-500/20 text-emerald-400" 
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {testResult.success ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" /> : <XCircle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />}
          <span>{testResult.message}</span>
        </div>
      )}
    </div>
  );
}

