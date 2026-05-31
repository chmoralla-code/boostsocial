"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle, Database, RotateCw, Loader2, Server, HardDrive, ShieldCheck } from "lucide-react";

export function StorageOptimizingPanel() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [stats, setStats] = useState<any>(null);
  const [fetchingStats, setFetchingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/storage-stats");
      const data = await res.json();
      if (data.success) {
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingStats(false);
    }
  };

  const handleOptimize = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/cleanup-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Optimization request failed");
      }

      if (data.count > 0) {
        setMessage(`🎉 Success: ${data.message}`);
        fetchStats(); // refresh stats to show newly freed space
      } else {
        setMessage("✅ Storage is already optimized! No old files needed purging.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during storage cleanup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#181818] border border-slate-800 rounded-2xl p-6 shadow-md text-white mt-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#1DB954]/5 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
      
      <div className="flex flex-col lg:flex-row items-stretch gap-6">
        {/* Left Side: General Optimization Action */}
        <div className="flex-grow space-y-3.5 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-[#1DB954]/10 text-[#1DB954] p-1.5 rounded-lg border border-[#1DB954]/20">
                <Database size={18} />
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">Supabase Storage Optimizer</h3>
            </div>
            <p className="text-xs text-slate-400 max-w-md font-semibold leading-relaxed">
              Clean up outdated payment screenshots and page custom branding attachments for finalized SMM transactions over 3 days old to preserve storage.
            </p>
          </div>

          <button
            onClick={handleOptimize}
            disabled={loading}
            className="w-full lg:w-fit bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-500 text-black font-extrabold px-6 py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider flex-shrink-0"
          >
            {loading ? (
              <RotateCw size={14} className="animate-spin text-black" />
            ) : (
              <ShieldCheck size={14} />
            )}
            {loading ? "Optimizing..." : "Optimize Storage"}
          </button>
        </div>

        {/* Right Side: Dual Telemetry Displays */}
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 border-t lg:border-t-0 lg:border-l border-slate-850 pt-6 lg:pt-0 lg:pl-6 min-w-[50%]">
          
          {/* Main Primary Server telemetry */}
          <div className="bg-[#121212] border border-slate-850 p-4 rounded-xl flex-1 space-y-3">
            <div className="flex items-center gap-1.5">
              <Server size={12} className="text-[#1DB954]" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Primary Database</span>
              <span className="w-1.5 h-1.5 bg-[#1DB954] rounded-full animate-pulse ml-auto"></span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-semibold text-slate-500">Storage Bucket</span>
                {fetchingStats ? (
                  <Loader2 size={10} className="animate-spin text-[#1DB954]" />
                ) : (
                  <span className="font-bold text-slate-350">{stats ? `${stats.usedMB} MB / 1 GB` : "1 GB"}</span>
                )}
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-[#1DB954] h-full transition-all duration-500" 
                  style={{ width: `${stats ? Math.min(Number(stats.percentage), 100) : 0}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="font-semibold text-slate-500">Database Size</span>
                <span className="font-bold text-slate-350">{stats ? `${stats.dbSizeMB} MB / 500 MB` : "500 MB"}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-blue-400 h-full transition-all duration-500" 
                  style={{ width: `${stats ? Math.min(Number(stats.dbPercentage), 100) : 0}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="font-semibold text-slate-500">Auth Users</span>
                <span className="font-extrabold text-[#1DB954]">{stats ? `${stats.totalUsers} Active` : "—"}</span>
              </div>
            </div>
          </div>

          {/* Backup Database telemetry */}
          <div className="bg-[#121212] border border-slate-850 p-4 rounded-xl flex-1 space-y-3">
            <div className="flex items-center gap-1.5">
              <HardDrive size={12} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Backup (Tokyo)</span>
              {stats?.backup?.active ? (
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse ml-auto"></span>
              ) : (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full ml-auto"></span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-semibold text-slate-500">Storage Bucket</span>
                {fetchingStats ? (
                  <Loader2 size={10} className="animate-spin text-blue-400" />
                ) : (
                  <span className="font-bold text-slate-350">{stats?.backup?.active ? `${stats.backup.usedMB} MB / 1 GB` : "1 GB"}</span>
                )}
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-500" 
                  style={{ width: `${stats?.backup?.active ? Math.min(Number(stats.backup.percentage), 100) : 0}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="font-semibold text-slate-500">Database Size</span>
                <span className="font-bold text-slate-350">{stats?.backup?.active ? `${stats.backup.dbSizeMB} MB / 500 MB` : "500 MB"}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-purple-500 h-full transition-all duration-500" 
                  style={{ width: `${stats?.backup?.active ? Math.min(Number(stats.backup.dbPercentage), 100) : 0}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="font-semibold text-slate-500">Auth Users</span>
                <span className="font-extrabold text-blue-400">{stats?.backup?.active ? `${stats.backup.totalUsers} Active` : "—"}</span>
              </div>
            </div>
          </div>

          {/* Backup 3 Database telemetry */}
          <div className="bg-[#121212] border border-slate-850 p-4 rounded-xl flex-1 space-y-3">
            <div className="flex items-center gap-1.5">
              <HardDrive size={12} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Backup 3</span>
              {stats?.backup3?.active ? (
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse ml-auto"></span>
              ) : (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full ml-auto"></span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-semibold text-slate-500">Storage Bucket</span>
                {fetchingStats ? (
                  <Loader2 size={10} className="animate-spin text-emerald-400" />
                ) : (
                  <span className="font-bold text-slate-350">{stats?.backup3?.active ? `${stats.backup3.usedMB} MB / 1 GB` : "1 GB"}</span>
                )}
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${stats?.backup3?.active ? Math.min(Number(stats.backup3.percentage), 100) : 0}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="font-semibold text-slate-500">Database Size</span>
                <span className="font-bold text-slate-350">{stats?.backup3?.active ? `${stats.backup3.dbSizeMB} MB / 500 MB` : "500 MB"}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-teal-500 h-full transition-all duration-500"
                  style={{ width: `${stats?.backup3?.active ? Math.min(Number(stats.backup3.dbPercentage), 100) : 0}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="font-semibold text-slate-500">Auth Users</span>
                <span className="font-extrabold text-emerald-400">{stats?.backup3?.active ? `${stats.backup3.totalUsers} Active` : "—"}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {message && (
        <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200">
          <CheckCircle size={16} className="flex-shrink-0 text-emerald-400 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl flex items-start gap-2.5 text-left text-xs font-semibold leading-relaxed animate-in fade-in duration-200">
          <ShieldAlert size={16} className="flex-shrink-0 text-red-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
