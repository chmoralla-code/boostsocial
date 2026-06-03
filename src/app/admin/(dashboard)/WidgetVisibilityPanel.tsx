'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { notifyWidgetVisibilityChanged } from '@/hooks/useWidgetVisibility';

interface WidgetVisibilitySettings {
  featureBadges: boolean;
  qualityFilter: boolean;
  chathead: boolean;
  liveTicker: boolean;
}

const WIDGETS = [
  { key: 'featureBadges' as const, label: 'Feature Badges', description: 'Monetization Safe, PH Base, Taglish Handshake, GCash Auto-Verify badges in checkout', color: '#1DB954' },
  { key: 'qualityFilter' as const, label: 'Service Quality Filter', description: 'Organic / Non-Organic toggle in the SMM service catalog', color: '#818cf8' },
  { key: 'chathead' as const, label: 'Support Chathead', description: 'Floating support chat button on the bottom-right corner', color: '#1877F2' },
  { key: 'liveTicker' as const, label: 'Live Order Ticker', description: 'Scrolling live order notification at the bottom-left corner', color: '#f97316' },
];

export function WidgetVisibilityPanel() {
  const [settings, setSettings] = useState<WidgetVisibilitySettings>({ featureBadges: true, qualityFilter: true, chathead: true, liveTicker: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/widget-visibility');
      if (res.ok) { setSettings(await res.json()); }
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = async (key: keyof WidgetVisibilitySettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/widget-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        setResult({ success: true, message: 'Widget visibility updated successfully.' });
        notifyWidgetVisibilityChanged();
        setTimeout(() => setResult(null), 3000);
      } else { throw new Error('Failed to save'); }
    } catch {
      setResult({ success: false, message: 'Failed to update settings.' });
      setSettings(settings);
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className='bg-[#181818] border border-slate-800 rounded-2xl p-6 shadow-md mt-6'>
        <div className='flex items-center gap-2 text-slate-500'>
          <Loader2 size={16} className='animate-spin' />
          <span className='text-xs font-bold'>Loading widget visibility settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-[#181818] border border-slate-800 rounded-2xl p-6 shadow-md mt-6 relative overflow-hidden'>
      <div className='absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none'></div>
      <div className='flex items-center gap-2 mb-1'>
        <span className='p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'>
          <Eye size={18} />
        </span>
        <h3 className='text-base font-bold text-white tracking-tight'>Widget Visibility Controls</h3>
      </div>
      <p className='text-xs text-slate-400 mb-5 font-semibold'>Toggle which floating widgets and UI elements are visible on the public site.</p>
      <div className='space-y-3'>
        {WIDGETS.map(({ key, label, description, color }) => {
          const enabled = settings[key];
          return (
            <div key={key} className='flex items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200' style={{ borderColor: enabled ? color + '30' : 'rgb(30 41 59 / 0.5)', background: enabled ? color + '08' : 'transparent' }}>
              <div className='flex items-start gap-3 flex-1 min-w-0'>
                <div className='min-w-0'>
                  <div className='text-sm font-bold text-white flex items-center gap-2'>
                    {label}
                    {enabled ? (
                      <span className='text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full' style={{ background: color + '15', color, border: '1px solid ' + color + '30' }}>Visible</span>
                    ) : (
                      <span className='text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700'>Hidden</span>
                    )}
                  </div>
                  <p className='text-[11px] text-slate-500 mt-0.5 font-semibold'>{description}</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle(key)}
                disabled={saving}
                className='relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 focus:outline-none disabled:opacity-50'
                style={{ background: enabled ? color : '#334155' }}
              >
                <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-300 flex items-center justify-center ${enabled ? 'translate-x-5' : 'translate-x-0'}`}>
                  {saving ? <Loader2 size={12} className='animate-spin text-slate-900' /> : enabled ? <Eye size={12} className='text-slate-700' /> : <EyeOff size={12} className='text-slate-400' />}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {result && (
        <div className={`mt-4 p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-semibold animate-in fade-in duration-200 ${result.success ? 'bg-[#1DB954]/10 border border-[#1DB954]/20 text-[#1DB954]' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {result.success ? <CheckCircle size={16} className='flex-shrink-0 mt-0.5' /> : <AlertCircle size={16} className='flex-shrink-0 mt-0.5' />}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
