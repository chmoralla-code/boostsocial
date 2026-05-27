"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CheckCircle, Loader2, RotateCcw, Save, Upload, Video, XCircle } from "lucide-react";

const DEFAULT_VIDEO_URL = "/hero-bg.mp4";
const DEFAULT_TITLE = "Real Service Delivery Samples";
const DEFAULT_BADGE = "Legit & Fast";

export function ShowcaseVideoSettingsPanel() {
  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO_URL);
  const [posterUrl, setPosterUrl] = useState("");
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [badge, setBadge] = useState(DEFAULT_BADGE);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/showcase-video-settings")
      .then((r) => r.json())
      .then((data) => {
        setVideoUrl(data.videoUrl || DEFAULT_VIDEO_URL);
        setPosterUrl(data.posterUrl || "");
        setTitle(data.title || DEFAULT_TITLE);
        setBadge(data.badge || DEFAULT_BADGE);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const saveSettings = async (nextVideoUrl = videoUrl) => {
    const formData = new FormData();
    formData.append("action", "save");
    formData.append("videoUrl", nextVideoUrl);
    formData.append("posterUrl", posterUrl);
    formData.append("title", title);
    formData.append("badge", badge);

    const res = await fetch("/api/admin/showcase-video-settings", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Save failed.");
    }

    setVideoUrl(data.videoUrl || DEFAULT_VIDEO_URL);
    setPosterUrl(data.posterUrl || "");
    setTitle(data.title || DEFAULT_TITLE);
    setBadge(data.badge || DEFAULT_BADGE);
    return data;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setResult({ success: false, message: "File is too large. Maximum size is 20MB." });
      return;
    }

    if (!file.type.startsWith("video/")) {
      setResult({ success: false, message: "Invalid file type. Please select an MP4 or browser-playable video." });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setResult(null);

    try {
      const signFormData = new FormData();
      signFormData.append("action", "get_upload_url");
      signFormData.append("fileName", file.name);
      signFormData.append("fileType", file.type);

      const signRes = await fetch("/api/admin/showcase-video-settings", {
        method: "POST",
        body: signFormData
      });

      const signData = await signRes.json();
      if (!signRes.ok) {
        throw new Error(signData.error || "Failed to generate signed upload URL.");
      }

      if (!signData.path || !signData.token) {
        throw new Error("Storage upload token was not returned.");
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase public upload settings are missing.");
      }

      setUploadProgress(35);

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .uploadToSignedUrl(signData.path, signData.token, file, {
          contentType: file.type
        });

      if (uploadError) {
        throw uploadError;
      }

      setUploadProgress(85);
      await saveSettings(signData.publicUrl);
      setUploadProgress(100);
      setResult({ success: true, message: "Showcase video uploaded and saved." });
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Failed to upload showcase video." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setResult(null);

    try {
      await saveSettings();
      setResult({ success: true, message: "Showcase video settings saved." });
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Connection error. Save failed." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset the service delivery sample video to the default?")) {
      return;
    }

    setIsResetting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("reset", "true");

      const res = await fetch("/api/admin/showcase-video-settings", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Reset failed.");
      }

      setVideoUrl(data.videoUrl || DEFAULT_VIDEO_URL);
      setPosterUrl(data.posterUrl || "");
      setTitle(data.title || DEFAULT_TITLE);
      setBadge(data.badge || DEFAULT_BADGE);
      setResult({ success: true, message: "Showcase video reset to default." });
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Connection error. Reset failed." });
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#181818] rounded-2xl border border-slate-850/85 p-6 flex items-center gap-3 mt-6">
        <Loader2 className="animate-spin text-[#1DB954]" size={20} />
        <span className="text-xs text-slate-400 font-semibold">Loading showcase video settings...</span>
      </div>
    );
  }

  const isCustomMediaActive = videoUrl !== DEFAULT_VIDEO_URL;

  return (
    <div className="bg-[#181818] rounded-2xl border border-slate-850/80 p-6 mt-6 relative overflow-hidden text-white shadow-md">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-850/60">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <Video size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Service Delivery Sample Video
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
              isCustomMediaActive
                ? "bg-purple-550/10 text-purple-400 border-purple-500/20"
                : "bg-green-550/10 text-[#1DB954] border-green-500/20"
            }`}>
              {isCustomMediaActive ? "Custom" : "Default"}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">
            Edit the homepage video labeled Real Service Delivery Sample.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
        <div className="space-y-4">
          <div className="bg-[#121212]/80 border border-slate-850 rounded-xl p-4 text-xs space-y-2.5 text-slate-400">
            <p className="font-black text-emerald-400 uppercase tracking-wide text-[10px]">Media Requirements</p>
            <ul className="list-disc pl-4 space-y-1.5 leading-relaxed font-semibold">
              <li>Upload an MP4 or another browser-playable video format.</li>
              <li>Maximum file size limit is <strong className="text-slate-350">20 MB</strong>.</li>
              <li>Use a short, clear delivery proof clip for best mobile playback.</li>
            </ul>
          </div>

          <div className="bg-[#121212]/80 border border-slate-850 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Video URL
              </label>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f0f0f] border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-xs font-semibold placeholder-slate-600"
                placeholder={DEFAULT_VIDEO_URL}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Poster Image URL
              </label>
              <input
                type="text"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f0f0f] border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-xs font-semibold placeholder-slate-600"
                placeholder="/gcash-qr.png"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Card Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f0f0f] border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-xs font-semibold placeholder-slate-600"
                placeholder={DEFAULT_TITLE}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Badge Text
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f0f0f] border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#1DB954] text-xs font-semibold placeholder-slate-600"
                placeholder={DEFAULT_BADGE}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/*"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isResetting || isSaving}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-550 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin text-black" /> : <Upload size={14} />}
              {isUploading ? "Uploading..." : "Upload Video"}
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={isUploading || isResetting || isSaving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-850 disabled:text-slate-550 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md border border-emerald-500/35"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? "Saving..." : "Save Settings"}
            </button>

            {isCustomMediaActive && (
              <button
                onClick={handleReset}
                disabled={isUploading || isResetting || isSaving}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md border border-slate-700"
              >
                {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {isResetting ? "Resetting..." : "Reset"}
              </button>
            )}
          </div>

          {isUploading && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <span>Uploading to Supabase Storage</span>
                <span className="text-emerald-400">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-[#121212] h-2 rounded-full overflow-hidden border border-slate-850">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_#10b981/50]"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#121212]/50 border border-slate-850 rounded-2xl overflow-hidden aspect-video flex flex-col justify-between p-3.5 relative group shadow-inner">
          <video
            key={videoUrl}
            src={videoUrl || DEFAULT_VIDEO_URL}
            poster={posterUrl || "/gcash-qr.png"}
            controls
            preload="metadata"
            playsInline
            className="absolute inset-0 w-full h-full object-cover rounded-xl transition-opacity duration-300 bg-black"
          />

          <div className="z-10 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/[0.07] text-white self-start">
            Live Preview
          </div>

          <div className="z-10 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-semibold text-slate-400 border border-white/[0.07] truncate max-w-full">
            {title} / {badge}
          </div>
        </div>
      </div>

      {result && (
        <div
          className={`border p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200 ${
            result.success
              ? "bg-green-500/10 border-green-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {result.success ? (
            <CheckCircle size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" />
          ) : (
            <XCircle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />
          )}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
