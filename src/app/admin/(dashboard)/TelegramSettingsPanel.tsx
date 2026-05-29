"use client";

import { useState, useEffect } from "react";
import { Bot, Send, CheckCircle, XCircle, Loader2, Save, Wallet, Globe, ShieldAlert } from "lucide-react";

export function TelegramSettingsPanel() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [topupBotToken, setTopupBotToken] = useState("");
  const [topupChatId, setTopupChatId] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  // Order bot states
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isTestingOrder, setIsTestingOrder] = useState(false);
  const [saveResultOrder, setSaveResultOrder] = useState<{ success: boolean; message: string } | null>(null);
  const [testResultOrder, setTestResultOrder] = useState<{ success: boolean; message: string } | null>(null);

  // Top-up bot states
  const [isSavingTopup, setIsSavingTopup] = useState(false);
  const [isTestingTopup, setIsTestingTopup] = useState(false);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [saveResultTopup, setSaveResultTopup] = useState<{ success: boolean; message: string } | null>(null);
  const [testResultTopup, setTestResultTopup] = useState<{ success: boolean; message: string } | null>(null);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load saved config on mount
  useEffect(() => {
    fetch("/api/admin/telegram-settings")
      .then((r) => r.json())
      .then((data) => {
        setBotToken(data.bot_token || "");
        setChatId(data.chat_id || "");
        setTopupBotToken(data.topup_bot_token || "");
        setTopupChatId(data.topup_chat_id || "");
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const handleSaveOrder = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setSaveResultOrder({ success: false, message: "Please fill in both fields before saving." });
      return;
    }
    setIsSavingOrder(true);
    setSaveResultOrder(null);
    try {
      const res = await fetch("/api/admin/telegram-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken.trim(), chat_id: chatId.trim() }),
      });
      const data = await res.json();
      setSaveResultOrder({
        success: res.ok,
        message: res.ok ? "✅ Order alerts bot settings saved!" : `❌ ${data.error}`,
      });
    } catch {
      setSaveResultOrder({ success: false, message: "❌ Failed to save. Check your connection." });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSaveTopup = async () => {
    if (!topupBotToken.trim() || !topupChatId.trim()) {
      setSaveResultTopup({ success: false, message: "Please fill in both fields before saving." });
      return;
    }
    setIsSavingTopup(true);
    setSaveResultTopup(null);
    try {
      const res = await fetch("/api/admin/telegram-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topup_bot_token: topupBotToken.trim(), topup_chat_id: topupChatId.trim() }),
      });
      const data = await res.json();
      setSaveResultTopup({
        success: res.ok,
        message: res.ok ? "✅ Top-up bot settings saved!" : `❌ ${data.error}`,
      });
    } catch {
      setSaveResultTopup({ success: false, message: "❌ Failed to save. Check your connection." });
    } finally {
      setIsSavingTopup(false);
    }
  };

  const handleTestOrder = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setTestResultOrder({ success: false, message: "Save your settings first before testing." });
      return;
    }
    setIsTestingOrder(true);
    setTestResultOrder(null);
    try {
      const res = await fetch("/api/admin/telegram-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken.trim(), chat_id: chatId.trim() }),
      });
      const data = await res.json();
      setTestResultOrder({
        success: res.ok,
        message: res.ok
          ? "✅ Connection successful! Test message sent to your Telegram."
          : `❌ ${data.error} — Make sure you started your bot first.`,
      });
    } catch {
      setTestResultOrder({ success: false, message: "❌ Connection error." });
    } finally {
      setIsTestingOrder(false);
    }
  };

  const handleTestTopup = async () => {
    if (!topupBotToken.trim() || !topupChatId.trim()) {
      setTestResultTopup({ success: false, message: "Save your settings first before testing." });
      return;
    }
    setIsTestingTopup(true);
    setTestResultTopup(null);
    try {
      const res = await fetch("/api/admin/telegram-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_token: topupBotToken.trim(),
          chat_id: topupChatId.trim(),
          test_topup: true
        }),
      });
      const data = await res.json();
      setTestResultTopup({
        success: res.ok,
        message: res.ok
          ? "✅ Test top-up notification sent! Check Telegram for approval buttons."
          : `❌ ${data.error}`,
      });
    } catch {
      setTestResultTopup({ success: false, message: "❌ Connection error." });
    } finally {
      setIsTestingTopup(false);
    }
  };

  const handleSetupWebhook = async () => {
    if (!topupBotToken.trim()) {
      setWebhookResult({ success: false, message: "Please enter and save Top-up bot settings first." });
      return;
    }
    setIsSettingWebhook(true);
    setWebhookResult(null);
    try {
      // Build webhook URL based on current window location
      const webhookUrl = `${window.location.origin}/api/telegram/webhook`;
      const res = await fetch("/api/telegram/setup-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = await res.json();
      setWebhookResult({
        success: res.ok,
        message: res.ok 
          ? `✅ Webhook successfully registered to: ${webhookUrl}`
          : `❌ Failed: ${data.error}`
      });
    } catch {
      setWebhookResult({ success: false, message: "❌ Network error registering webhook." });
    } finally {
      setIsSettingWebhook(false);
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

  const isOrderConfigured = botToken.trim() && chatId.trim();
  const isTopupConfigured = topupBotToken.trim() && topupChatId.trim();

  return (
    <div className="bg-[#181818] rounded-2xl border border-slate-850/80 p-6 mt-6 relative overflow-hidden text-white shadow-md">
      {/* Soft decorative glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-850/60">
        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
          <Bot size={20} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Telegram Integration Settings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">
            Configure separate Telegram bots for order notifications and wallet top-up approvals.
          </p>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-[#121212]/80 border border-slate-850 rounded-xl p-4 mb-6 text-xs space-y-2 text-slate-400">
        <p className="font-black text-blue-400 uppercase tracking-wide text-[10px] mb-2">📖 How to set up your Telegram bots</p>
        <p className="leading-relaxed">
          <span className="font-bold text-slate-300">1. Bot Token:</span> Search for{" "}
          <span className="font-mono font-bold text-blue-400 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">@BotFather</span> on Telegram → type{" "}
          <span className="font-mono bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-blue-400">/newbot</span> → create one bot for Order Notifications and one bot for Wallet Top-ups. Save both bot tokens.
        </p>
        <p className="leading-relaxed">
          <span className="font-bold text-slate-300">2. Chat ID:</span> Search for{" "}
          <span className="font-mono font-bold text-blue-400 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">@Intergram_Bot</span> → press <strong>Start</strong>. It will instantly reply with your <strong>Chat ID</strong> (you can use this same ID for both bots so all notifications go to your account).
        </p>
        <p className="leading-relaxed">
          <span className="font-bold text-slate-300">3. Activate Webhook:</span> For the Wallet Top-ups bot, you **MUST** click the **Register Webhook** button after saving to enable the inline Approve/Reject buttons to process actions directly from your Telegram screen.
        </p>
      </div>

      {/* Grid of separate Bot configurations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        
        {/* PANEL 1: Order Notifications Bot */}
        <div className="bg-[#131313] border border-slate-850 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-850/60">
              <span className="font-extrabold text-xs text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                🛒 Order Alerts Bot
              </span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
                isOrderConfigured
                  ? "bg-green-550/10 text-[#1DB954] border-green-500/20"
                  : "bg-orange-550/10 text-orange-400 border-orange-500/20"
              }`}>
                {isOrderConfigured ? "Active" : "Offline"}
              </span>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  🤖 Bot Token
                </label>
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => { setBotToken(e.target.value); setSaveResultOrder(null); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#121212]/60 border border-slate-850 focus:outline-none focus:ring-2 focus:ring-[#1DB954]/50 focus:border-[#1DB954] text-white text-xs font-mono transition-all placeholder:text-slate-650"
                  placeholder="e.g. 1234567890:ABCdef..."
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  💬 Chat ID
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => { setChatId(e.target.value); setSaveResultOrder(null); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#121212]/60 border border-slate-850 focus:outline-none focus:ring-2 focus:ring-[#1DB954]/50 focus:border-[#1DB954] text-white text-xs font-mono transition-all placeholder:text-slate-650"
                  placeholder="e.g. 5144639792"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-550 text-black font-extrabold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                {isSavingOrder ? <Loader2 size={12} className="animate-spin text-black" /> : <Save size={12} />}
                Save
              </button>

              <button
                onClick={handleTestOrder}
                disabled={isTestingOrder}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-extrabold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                {isTestingOrder ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Test Bot
              </button>
            </div>

            {saveResultOrder && (
              <div className={`mt-3 border p-2.5 rounded-lg flex items-start gap-2 text-left text-[11px] leading-relaxed animate-in fade-in duration-200 ${
                saveResultOrder.success ? "bg-green-500/10 border-green-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
                {saveResultOrder.success ? <CheckCircle size={13} className="flex-shrink-0 mt-0.5" /> : <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
                <span>{saveResultOrder.message}</span>
              </div>
            )}

            {testResultOrder && (
              <div className={`mt-2 border p-2.5 rounded-lg flex items-start gap-2 text-left text-[11px] leading-relaxed animate-in fade-in duration-200 ${
                testResultOrder.success ? "bg-green-500/10 border-green-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
                {testResultOrder.success ? <CheckCircle size={13} className="flex-shrink-0 mt-0.5" /> : <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
                <span>{testResultOrder.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 2: Wallet Top-Up Approvals Bot */}
        <div className="bg-[#131313] border border-slate-850 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-850/60">
              <span className="font-extrabold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                💰 Top-Up Approval Bot
              </span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
                isTopupConfigured
                  ? "bg-green-550/10 text-[#1DB954] border-green-500/20"
                  : "bg-orange-550/10 text-orange-400 border-orange-500/20"
              }`}>
                {isTopupConfigured ? "Active" : "Offline"}
              </span>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  🤖 Bot Token
                </label>
                <input
                  type="text"
                  value={topupBotToken}
                  onChange={(e) => { setTopupBotToken(e.target.value); setSaveResultTopup(null); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#121212]/60 border border-slate-850 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white text-xs font-mono transition-all placeholder:text-slate-650"
                  placeholder="e.g. 9876543210:XYZabc..."
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  💬 Chat ID <span className="text-slate-500 font-normal tracking-normal lowercase">(usually same as above)</span>
                </label>
                <input
                  type="text"
                  value={topupChatId}
                  onChange={(e) => { setTopupChatId(e.target.value); setSaveResultTopup(null); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#121212]/60 border border-slate-850 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white text-xs font-mono transition-all placeholder:text-slate-650"
                  placeholder="e.g. 5144639792"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={handleSaveTopup}
                  disabled={isSavingTopup}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-550 text-black font-extrabold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  {isSavingTopup ? <Loader2 size={12} className="animate-spin text-black" /> : <Save size={12} />}
                  Save
                </button>

                <button
                  onClick={handleTestTopup}
                  disabled={isTestingTopup}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-extrabold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  {isTestingTopup ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
                  Test Top-Up
                </button>
              </div>

              <button
                onClick={handleSetupWebhook}
                disabled={isSettingWebhook}
                className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                {isSettingWebhook ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                🔗 Register Webhook
              </button>
            </div>

            {saveResultTopup && (
              <div className={`mt-3 border p-2.5 rounded-lg flex items-start gap-2 text-left text-[11px] leading-relaxed animate-in fade-in duration-200 ${
                saveResultTopup.success ? "bg-green-500/10 border-green-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
                {saveResultTopup.success ? <CheckCircle size={13} className="flex-shrink-0 mt-0.5" /> : <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
                <span>{saveResultTopup.message}</span>
              </div>
            )}

            {testResultTopup && (
              <div className={`mt-2 border p-2.5 rounded-lg flex items-start gap-2 text-left text-[11px] leading-relaxed animate-in fade-in duration-200 ${
                testResultTopup.success ? "bg-green-500/10 border-green-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
                {testResultTopup.success ? <CheckCircle size={13} className="flex-shrink-0 mt-0.5" /> : <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
                <span>{testResultTopup.message}</span>
              </div>
            )}

            {webhookResult && (
              <div className={`mt-2 border p-2.5 rounded-lg flex items-start gap-2 text-left text-[11px] leading-relaxed animate-in fade-in duration-200 ${
                webhookResult.success ? "bg-green-500/10 border-green-500/20 text-indigo-400" : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
                {webhookResult.success ? <CheckCircle size={13} className="flex-shrink-0 mt-0.5" /> : <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
                <span>{webhookResult.message}</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Webhook Warning and Notice */}
      <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-xl p-4 flex gap-3 text-xs text-indigo-300">
        <ShieldAlert size={18} className="text-indigo-400 flex-shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <p className="font-extrabold text-indigo-200 uppercase tracking-wide text-[10px]">⚠️ Webhook Notice</p>
          <p className="leading-relaxed">
            The **Top-up bot** requires an active webhook mapping Telegram inline query interactions back to your server. 
            Once you save your Top-up Bot token, click **Register Webhook** above. 
            This will bind the bot to the live URL: <span className="font-mono text-indigo-400">https://pinoyboosting.com/api/telegram/webhook</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
