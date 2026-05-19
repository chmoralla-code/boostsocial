"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle, Database, RotateCw, Loader2 } from "lucide-react";

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
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-[#1DB954]/10 text-[#1DB954] p-1.5 rounded-lg border border-[#1DB954]/20">
              <Database size={18} />
            </span>
            <h3 className="text-base font-bold text-white tracking-tight">Supabase Storage Optimizer</h3>
          </div>
          <p className="text-xs text-slate-400 max-w-md font-semibold leading-relaxed">
            Clean up outdated payment screenshots and page custom branding attachments for finalized transactions over 3 days old to preserve storage.
          </p>
          
          <div className="flex gap-4 mt-3 pt-3 border-t border-slate-800">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                Bucket Storage
                {fetchingStats && <Loader2 size={10} className="animate-spin text-[#1DB954]" />}
              </span>
              {stats ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-bold text-[#1DB954]">{stats.remainingMB} MB Free</span>
                  <span className="text-[9px] font-bold text-slate-500">/ 1 GB</span>
                </div>
              ) : (
                <span className="text-xs font-bold text-[#1DB954]">1 GB Limit</span>
              )}
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Database Size</span>
              <span className="text-xs font-bold text-blue-400">500 MB Limit</span>
            </div>
            <div className="flex flex-col hidden sm:flex">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Auth Users</span>
              <span className="text-xs font-bold text-purple-400">50,000 MAU</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleOptimize}
          disabled={loading}
          className="bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-500 text-black font-extrabold px-5 py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider flex-shrink-0"
        >
          {loading ? (
            <RotateCw size={14} className="animate-spin text-black" />
          ) : (
            <Database size={14} />
          )}
          {loading ? "Optimizing..." : "Optimize Storage"}
        </button>
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
