"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle, Database, RotateCw, Loader2, Server, HardDrive, ShieldCheck } from "lucide-react";

type ProjectMetrics = {
  active?: boolean;
  usedMB?: string;
  percentage?: string;
  dbSizeMB?: string;
  dbPercentage?: string;
  totalUsers?: number;
};

type StorageStats = ProjectMetrics & {
  success?: boolean;
  backup1?: ProjectMetrics;
  backup?: ProjectMetrics;
  backup3?: ProjectMetrics;
  backup4?: ProjectMetrics;
  backup5?: ProjectMetrics;
};

type TelemetryCardProps = {
  title: string;
  accent: string;
  barAccent: string;
  dbAccent: string;
  active: boolean;
  fetching: boolean;
  metrics?: ProjectMetrics;
  primary?: boolean;
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

function TelemetryCard({ title, accent, barAccent, dbAccent, active, fetching, metrics, primary }: TelemetryCardProps) {
  const Icon = primary ? Server : HardDrive;
  const used = metrics?.usedMB;
  const storagePercent = metrics?.percentage ? Math.min(Number(metrics.percentage), 100) : 0;
  const dbPercent = metrics?.dbPercentage ? Math.min(Number(metrics.dbPercentage), 100) : 0;

  return (
    <div className="bg-[#121212] border border-slate-850 p-4 rounded-xl min-w-0 space-y-3">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={accent} />
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">{title}</span>
        <span className={`w-1.5 h-1.5 rounded-full ml-auto ${active ? `${barAccent} animate-pulse` : "bg-red-500"}`}></span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] gap-3">
          <span className="font-semibold text-slate-500">Storage Bucket</span>
          {fetching ? (
            <Loader2 size={10} className={`animate-spin ${accent}`} />
          ) : (
            <span className="font-bold text-slate-350 whitespace-nowrap">{active && used ? `${used} MB / 1 GB` : "1 GB"}</span>
          )}
        </div>
        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${barAccent}`}
            style={{ width: `${active ? storagePercent : 0}%` }}
          ></div>
        </div>

        <div className="flex justify-between items-center text-[10px] gap-3 pt-1">
          <span className="font-semibold text-slate-500">Database Size</span>
          <span className="font-bold text-slate-350 whitespace-nowrap">{active && metrics?.dbSizeMB ? `${metrics.dbSizeMB} MB / 500 MB` : "500 MB"}</span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${dbAccent}`}
            style={{ width: `${active ? dbPercent : 0}%` }}
          ></div>
        </div>

        <div className="flex justify-between items-center text-[10px] gap-3 pt-1">
          <span className="font-semibold text-slate-500">Auth Users</span>
          <span className={`font-extrabold whitespace-nowrap ${accent}`}>{active && metrics?.totalUsers !== undefined ? `${metrics.totalUsers} Active` : "-"}</span>
        </div>
      </div>
    </div>
  );
}

export function StorageOptimizingPanel() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [fetchingStats, setFetchingStats] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/storage-stats");
      const data = await res.json() as StorageStats;
      if (data.success) {
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

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
        setMessage(`Success: ${data.message}`);
        fetchStats();
      } else {
        setMessage("Storage is already optimized. No old files needed purging.");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "An error occurred during storage cleanup");
    } finally {
      setLoading(false);
    }
  };

  const telemetryCards = [
    {
      title: "DigitalOcean Primary",
      metrics: stats,
      active: true,
      accent: "text-[#1DB954]",
      barAccent: "bg-[#1DB954]",
      dbAccent: "bg-blue-400",
      primary: true,
    },
    {
      title: "Backup 1 (Supabase)",
      metrics: stats?.backup1,
      active: Boolean(stats?.backup1?.active),
      accent: "text-blue-400",
      barAccent: "bg-blue-400",
      dbAccent: "bg-indigo-500",
    },
    {
      title: "Backup 2 (Supabase)",
      metrics: stats?.backup,
      active: Boolean(stats?.backup?.active),
      accent: "text-blue-400",
      barAccent: "bg-blue-400",
      dbAccent: "bg-purple-500",
    },
    {
      title: "Backup 3 (Supabase)",
      metrics: stats?.backup3,
      active: Boolean(stats?.backup3?.active),
      accent: "text-emerald-400",
      barAccent: "bg-emerald-400",
      dbAccent: "bg-teal-500",
    },
    {
      title: "Backup 4 (Supabase)",
      metrics: stats?.backup4,
      active: Boolean(stats?.backup4?.active),
      accent: "text-cyan-400",
      barAccent: "bg-cyan-400",
      dbAccent: "bg-sky-500",
    },
    {
      title: "Backup 5 (Supabase)",
      metrics: stats?.backup5,
      active: Boolean(stats?.backup5?.active),
      accent: "text-amber-400",
      barAccent: "bg-amber-400",
      dbAccent: "bg-orange-500",
    },
  ];

  return (
    <div className="bg-[#181818] border border-slate-800 rounded-2xl p-6 shadow-md text-white mt-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#1DB954]/5 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex flex-col xl:flex-row items-stretch gap-6">
        <div className="xl:w-72 space-y-3.5 flex flex-col justify-between">
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
            className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-850 disabled:text-slate-500 text-black font-extrabold px-6 py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider flex-shrink-0"
          >
            {loading ? (
              <RotateCw size={14} className="animate-spin text-black" />
            ) : (
              <ShieldCheck size={14} />
            )}
            {loading ? "Optimizing..." : "Optimize Storage"}
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-4 border-t xl:border-t-0 xl:border-l border-slate-850 pt-6 xl:pt-0 xl:pl-6">
          {telemetryCards.map((card) => (
            <TelemetryCard
              key={card.title}
              title={card.title}
              metrics={card.metrics ?? undefined}
              active={card.active}
              accent={card.accent}
              barAccent={card.barAccent}
              dbAccent={card.dbAccent}
              primary={card.primary}
              fetching={fetchingStats}
            />
          ))}
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
