"use client";

import { useState, useEffect, useRef } from "react";
import { Video, Upload, RotateCcw, CheckCircle, XCircle, Loader2 } from "lucide-react";

export function HeroVideoSettingsPanel() {
  const [videoUrl, setVideoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current video URL on mount
  useEffect(() => {
    fetch("/api/admin/hero-video-settings")
      .then((r) => r.json())
      .then((data) => {
        setVideoUrl(data.videoUrl || "");
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

    const formData = new FormData();
    formData.append("file", file);

    try {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      });

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            setVideoUrl(response.videoUrl);
            setResult({ success: true, message: "✅ Hero video background updated successfully!" });
          } catch {
            setResult({ success: false, message: "❌ Failed to parse response from server." });
          }
        } else {
          try {
            const errResponse = JSON.parse(xhr.responseText);
            setResult({ success: false, message: `❌ ${errResponse.error || "Upload failed."}` });
          } catch {
            setResult({ success: false, message: `❌ Upload failed with status code ${xhr.status}.` });
          }
        }
        setIsUploading(false);
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        setResult({ success: false, message: "❌ Connection error during upload." });
        setIsUploading(false);
      });

      xhr.open("POST", "/api/admin/hero-video-settings");
      xhr.send(formData);

    } catch (err) {
      console.error(err);
      setResult({ success: false, message: "❌ Failed to upload hero video background." });
      setIsUploading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to reset the hero background to the default particles video?")) {
      return;
    }

    setIsResetting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("reset", "true");

      const res = await fetch("/api/admin/hero-video-settings", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setVideoUrl("");
        setResult({ success: true, message: "✅ Successfully reset to default hero background video!" });
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
        <span className="text-xs text-slate-400 font-semibold">Loading Hero Video Settings...</span>
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
            Hero Background Media
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
              isCustomVideoActive
                ? "bg-purple-550/10 text-purple-400 border-purple-500/20"
                : "bg-green-550/10 text-[#1DB954] border-green-500/20"
            }`}>
              {isCustomVideoActive ? "● Custom" : "○ Default"}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">
            Change or reset the video, GIF, or image background playing on your landing page.
          </p>
        </div>
      </div>

      {/* Main Panel Content split into Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
        {/* Left Side: Upload & Control */}
        <div className="space-y-4">
          <div className="bg-[#121212]/80 border border-slate-850 rounded-xl p-4 text-xs space-y-2.5 text-slate-400">
            <p className="font-black text-emerald-400 uppercase tracking-wide text-[10px]">🎥 Background Requirements</p>
            <ul className="list-disc pl-4 space-y-1.5 leading-relaxed font-semibold">
              <li>Supported formats: <strong className="text-slate-350">MP4, GIF, JPEG, JPG, PNG</strong>.</li>
              <li>Maximum file size limit is <strong className="text-slate-350">20 MB</strong>.</li>
              <li>A high-quality <strong className="text-slate-350">dark themed / low-contrast</strong> asset is highly recommended to preserve text readability.</li>
            </ul>
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
              disabled={isUploading || isResetting}
              className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-550 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin text-black" /> : <Upload size={14} />}
              {isUploading ? "Uploading..." : "Upload New File"}
            </button>

            {isCustomVideoActive && (
              <button
                onClick={handleReset}
                disabled={isUploading || isResetting}
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
                    className="absolute inset-0 w-full h-full object-cover rounded-xl"
                    alt="Hero background preview"
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
                    className="absolute inset-0 w-full h-full object-cover rounded-xl"
                  />
                );
              }
            } else {
              return (
                <video
                  src="/hero-bg.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-60"
                />
              );
            }
          })()}

          {/* Preview overlay label */}
          <div className="z-10 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/[0.07] text-white self-start">
            📺 Live Preview
          </div>

          <div className="z-10 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-semibold text-slate-400 border border-white/[0.07] truncate max-w-full">
            {videoUrl ? "Custom active: " + videoUrl.split("/").pop()?.split("?")[0] : "Static default: hero-bg.mp4"}
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
