"use client";

import { useState, useEffect, useRef } from "react";
import { Video, Upload, RotateCcw, CheckCircle, XCircle, Loader2, Save } from "lucide-react";

export function ServicesBgSettingsPanel() {
  const [videoUrl, setVideoUrl] = useState("");
  const [opacity, setOpacity] = useState(0.15);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current video URL and opacity on mount
  useEffect(() => {
    fetch("/api/admin/services-bg-settings")
      .then((r) => r.json())
      .then((data) => {
        setVideoUrl(data.videoUrl || "");
        setOpacity(data.opacity !== undefined ? Number(data.opacity) : 0.15);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 20MB for safety)
    if (file.size > 20 * 1024 * 1024) {
      setResult({ success: false, message: "❌ File is too large. Maximum size is 20MB." });
      return;
    }

    // Validate video or image MIME type
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      setResult({ success: false, message: "❌ Invalid file type. Please select an MP4 video, or a GIF/JPEG/JPG/PNG image." });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setResult(null);

    try {
      // 1. Get signed upload URL from backend
      const signFormData = new FormData();
      signFormData.append("action", "get_upload_url");
      signFormData.append("fileName", file.name);
      signFormData.append("fileType", file.type);

      const signRes = await fetch("/api/admin/services-bg-settings", {
        method: "POST",
        body: signFormData,
      });

      if (!signRes.ok) {
        const errorData = await signRes.json();
        throw new Error(errorData.error || "Failed to generate signed upload URL.");
      }

      const { signedUrl, publicUrl } = await signRes.json();

      // 2. Direct upload to Supabase Storage via PUT
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      
      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      });

      // Handle completion
      xhr.addEventListener("load", async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // 3. Finalize the configuration on backend
            const finalizeRes = await fetch("/api/admin/services-bg-settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "finalize",
                videoUrl: publicUrl,
                opacity: opacity.toString(),
              }),
            });

            if (finalizeRes.ok) {
              setVideoUrl(publicUrl);
              setResult({ success: true, message: "✅ Services background updated and settings saved successfully!" });
            } else {
              const errResponse = await finalizeRes.json();
              setResult({ success: false, message: `❌ Finalization failed: ${errResponse.error || "Unknown error"}` });
            }
          } catch {
            setResult({ success: false, message: "❌ Failed to finalize background configuration." });
          }
        } else {
          setResult({ success: false, message: `❌ Upload to storage failed with status code ${xhr.status}.` });
        }
        setIsUploading(false);
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        setResult({ success: false, message: "❌ Connection error during direct storage upload." });
        setIsUploading(false);
      });

      // Send the raw binary file directly
      xhr.send(file);

    } catch (err: any) {
      console.error(err);
      setResult({ success: false, message: `❌ ${err.message || "Failed to upload services background."}` });
      setIsUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/services-bg-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          videoUrl,
          opacity: opacity.toString(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: "✅ Services background settings saved successfully!" });
      } else {
        setResult({ success: false, message: `❌ ${data.error || "Save failed."}` });
      }
    } catch {
      setResult({ success: false, message: "❌ Connection error. Save failed." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to reset the services section background to default transparent/dark grid?")) {
      return;
    }

    setIsResetting(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/services-bg-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reset: true,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setVideoUrl("");
        setOpacity(0.15);
        setResult({ success: true, message: "✅ Successfully reset to default services background!" });
      } else {
        setResult({ success: false, message: `❌ ${data.error || "Reset failed."}` });
      }
    } catch {
      setResult({ success: false, message: "❌ Connection error. Reset failed." });
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#181818] rounded-2xl border border-slate-850/85 p-6 flex items-center gap-3 mt-6">
        <Loader2 className="animate-spin text-[#1DB954]" size={20} />
        <span className="text-xs text-slate-400 font-semibold">Loading Services Section Background Settings...</span>
      </div>
    );
  }

  const isCustomVideoActive = !!videoUrl;

  return (
    <div className="bg-[#181818] rounded-2xl border border-slate-850/80 p-6 mt-6 relative overflow-hidden text-white shadow-md">
      {/* Dynamic Spotify/Neon Glow Effect */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-850/60">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <Video size={20} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Services Section Background Media
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
              isCustomVideoActive
                ? "bg-purple-550/10 text-purple-400 border-purple-500/20"
                : "bg-green-550/10 text-[#1DB954] border-green-500/20"
            }`}>
              {isCustomVideoActive ? "● Custom Video" : "○ Default"}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">
            Add or change the video, GIF, or image background playing specifically behind the "Choose Your Boost Tier" services container.
          </p>
        </div>
      </div>

      {/* Main Panel Content split into Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
        {/* Left Side: Upload & Control */}
        <div className="space-y-4">
          <div className="bg-[#121212]/80 border border-slate-850 rounded-xl p-4 text-xs space-y-2.5 text-slate-400">
            <p className="font-black text-emerald-400 uppercase tracking-wide text-[10px]">🎥 Background Guidelines</p>
            <ul className="list-disc pl-4 space-y-1.5 leading-relaxed font-semibold">
              <li>Supported formats: <strong className="text-slate-350">MP4, GIF, JPEG, JPG, PNG</strong>.</li>
              <li>Maximum file size limit is <strong className="text-slate-350">20 MB</strong>.</li>
              <li>Keep the background extremely dark (<strong className="text-slate-350">opacity between 10% - 20%</strong>) so service cards remain fully readable and readable card text is preserved.</li>
            </ul>
          </div>

          {/* Opacity Adjustment Slider */}
          <div className="bg-[#121212]/80 border border-slate-850 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-emerald-400 uppercase tracking-wide text-[10px]">🎚️ Transparency / Opacity</p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-semibold">
                  Controls the visibility strength of the services section background.
                </p>
              </div>
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-inner">
                {Math.round(opacity * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Clear</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(parseFloat(e.target.value) / 100)}
                className="flex-grow h-1.5 bg-[#181818] rounded-lg appearance-none cursor-pointer accent-[#1DB954] border border-slate-850"
              />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Opaque</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="video/*,image/*"
              className="hidden"
            />
            
            <button
              onClick={handleUploadClick}
              disabled={isUploading || isResetting || isSaving}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-550 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin text-black" /> : <Upload size={14} />}
              {isUploading ? "Uploading..." : "Upload New File"}
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={isUploading || isResetting || isSaving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-850 disabled:text-slate-550 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md border border-emerald-500/35"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? "Saving..." : "Save Settings"}
            </button>

            {isCustomVideoActive && (
              <button
                onClick={handleReset}
                disabled={isUploading || isResetting || isSaving}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md border border-slate-700"
              >
                {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {isResetting ? "Resetting..." : "Reset to Default"}
              </button>
            )}
          </div>

          {/* Progress Bar */}
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

        {/* Right Side: Preview Video / Image */}
        <div className="bg-[#121212]/50 border border-slate-850 rounded-2xl overflow-hidden aspect-video flex flex-col justify-between p-3.5 relative group shadow-inner">
          {(() => {
            const isImage = (url: string) => {
              if (!url) return false;
              const cleanUrl = url.split("?")[0].toLowerCase();
              return (
                cleanUrl.endsWith(".gif") ||
                cleanUrl.endsWith(".jpg") ||
                cleanUrl.endsWith(".jpeg") ||
                cleanUrl.endsWith(".png") ||
                cleanUrl.endsWith(".webp")
              );
            };

            if (videoUrl) {
              if (isImage(videoUrl)) {
                return (
                  <img
                    src={videoUrl}
                    className="absolute inset-0 w-full h-full object-cover rounded-xl transition-opacity duration-300"
                    alt="Services background preview"
                    style={{ opacity }}
                  />
                );
              } else {
                return (
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover rounded-xl transition-opacity duration-300"
                    style={{ opacity }}
                  />
                );
              }
            } else {
              return (
                <div className="absolute inset-0 w-full h-full bg-[#0a0a0a] flex items-center justify-center rounded-xl transition-opacity duration-300">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">No background video (transparent grid)</span>
                </div>
              );
            }
          })()}

          {/* Preview overlay label */}
          <div className="z-10 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/[0.07] text-white self-start">
            📺 Live Preview
          </div>

          <div className="z-10 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-semibold text-slate-400 border border-white/[0.07] truncate max-w-full">
            {videoUrl ? "Custom active: " + videoUrl.split("/").pop()?.split("?")[0] : "Transparent dark grid default"}
          </div>
        </div>
      </div>

      {/* Response Feedback */}
      {result && (
        <div className={`border p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200 ${
          result.success 
            ? "bg-green-500/10 border-green-500/20 text-emerald-400" 
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {result.success ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" /> : <XCircle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
