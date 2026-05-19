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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center gap-3 mt-6">
        <Loader2 className="animate-spin text-slate-400" size={20} />
        <span className="text-sm text-slate-500">Loading Telegram settings...</span>
      </div>
    );
  }

  const isConfigured = botToken.trim() && chatId.trim();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
          <Bot size={20} className="text-blue-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Telegram Order Notifications
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
              isConfigured
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-orange-100 text-orange-600 border-orange-200"
            }`}>
              {isConfigured ? "● Active" : "○ Not Configured"}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Get instant Telegram alerts when a customer places an order.
          </p>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-xs space-y-2">
        <p className="font-black text-blue-700 uppercase tracking-wide text-[10px] mb-2">📖 How to get your credentials</p>
        <p className="text-slate-600">
          <span className="font-bold">1. Bot Token:</span> Open Telegram → search{" "}
          <span className="font-mono font-bold text-blue-600">@BotFather</span> → type{" "}
          <span className="font-mono bg-blue-100 px-1 rounded">/newbot</span> → follow the steps → copy the token it gives you.
        </p>
        <p className="text-slate-600">
          <span className="font-bold">2. Start your bot:</span> Search your bot by username in Telegram and press{" "}
          <strong>Start</strong>. This is required or messages won't deliver.
        </p>
        <p className="text-slate-600">
          <span className="font-bold">3. Chat ID:</span> After starting your bot, open this URL in your browser
          (replace token):{" "}
          <span className="font-mono text-blue-600 break-all">
            https://api.telegram.org/bot&lt;YOUR_TOKEN&gt;/getUpdates
          </span>{" "}
          → look for <span className="font-mono font-bold">"id"</span> inside the <span className="font-mono font-bold">"chat"</span> object.
        </p>
        <p className="text-slate-600">
          <span className="font-bold">4.</span> Paste both below → <strong>Save Settings</strong> → <strong>Test Bot</strong>.
        </p>
      </div>

      {/* Inputs */}
      <div className="space-y-4 mb-5">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
            🤖 BotFather Token
          </label>
          <input
            type="text"
            value={botToken}
            onChange={(e) => { setBotToken(e.target.value); setSaveResult(null); }}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 text-sm font-mono transition-all"
            placeholder="1234567890:ABCdefGHIjklmNoPQRsTUVwXYZ..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
            💬 Chat ID
          </label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => { setChatId(e.target.value); setSaveResult(null); }}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 text-sm font-mono transition-all"
            placeholder="e.g. 5144639792"
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            Your personal Chat ID is a plain number (e.g. <code>5144639792</code>). Group chats start with <code>-100...</code>
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isSaving ? "Saving..." : "Save Settings"}
        </button>

        <button
          onClick={handleTest}
          disabled={isTesting}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
        >
          {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isTesting ? "Sending Test..." : "Test Bot"}
        </button>
      </div>

      {/* Feedback */}
      {saveResult && (
        <div className={`flex items-start gap-2 mt-4 px-4 py-3 rounded-xl text-xs font-semibold border ${
          saveResult.success ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {saveResult.success ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" /> : <XCircle size={14} className="flex-shrink-0 mt-0.5" />}
          {saveResult.message}
        </div>
      )}
      {testResult && (
        <div className={`flex items-start gap-2 mt-3 px-4 py-3 rounded-xl text-xs font-semibold border ${
          testResult.success ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {testResult.success ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" /> : <XCircle size={14} className="flex-shrink-0 mt-0.5" />}
          {testResult.message}
        </div>
      )}
    </div>
  );
}
