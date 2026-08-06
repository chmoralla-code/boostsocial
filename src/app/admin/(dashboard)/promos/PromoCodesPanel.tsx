"use client";

import { useState, useCallback, useEffect } from "react";
import { Save, CheckCircle, XCircle, Loader2, Tag, Power, Trash2, Pencil } from "lucide-react";

type PromoRow = {
  id: string;
  code: string;
  discount_percent: number | string | null;
  discount_amount: number | string | null;
  max_uses: number | null;
  used_count: number | null;
  min_order_amount: number | string | null;
  applies_to: string | null;
  expires_at: string | null;
  active: boolean | null;
  created_at: string | null;
};

type FormState = {
  id?: string;
  code: string;
  discount_percent: string;
  discount_amount: string;
  max_uses: string;
  min_order_amount: string;
  applies_to: string;
  expires_at: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  code: "",
  discount_percent: "10",
  discount_amount: "0",
  max_uses: "100",
  min_order_amount: "0",
  applies_to: "all",
  expires_at: "",
  active: true,
};

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}

export function PromoCodesPanel({ initialPromos }: { initialPromos: PromoRow[] }) {
  const [promos, setPromos] = useState<PromoRow[]>(initialPromos || []);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/promos");
      const data = await res.json();
      if (res.ok) setPromos(data.promos || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const handleSave = async () => {
    setIsSaving(true);
    setResult(null);
    try {
      const payload = {
        action: editingId ? "update" : "create",
        id: editingId || undefined,
        code: form.code,
        discount_percent: Number(form.discount_percent),
        discount_amount: Number(form.discount_amount),
        max_uses: Number(form.max_uses),
        min_order_amount: Number(form.min_order_amount),
        applies_to: form.applies_to,
        expires_at: form.expires_at || null,
        active: form.active,
      };
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save promo code");
      setResult({ success: true, message: editingId ? "Promo code updated." : "Promo code created." });
      setForm(EMPTY_FORM);
      setEditingId(null);
      await refresh();
    } catch (e) {
      setResult({ success: false, message: getErrorMessage(e, "Failed to save promo code.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (promo: PromoRow) => {
    try {
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id: promo.id }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      await refresh();
    } catch (e) {
      setResult({ success: false, message: getErrorMessage(e, "Failed to toggle promo code.") });
    }
  };

  const handleDelete = async (promo: PromoRow) => {
    if (!window.confirm(`Delete promo code ${promo.code}?`)) return;
    try {
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: promo.id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setResult({ success: true, message: "Promo code deleted." });
      await refresh();
    } catch (e) {
      setResult({ success: false, message: getErrorMessage(e, "Failed to delete promo code.") });
    }
  };

  const startEdit = (promo: PromoRow) => {
    setEditingId(promo.id);
    setForm({
      code: promo.code,
      discount_percent: String(promo.discount_percent ?? 0),
      discount_amount: String(promo.discount_amount ?? 0),
      max_uses: String(promo.max_uses ?? 1),
      min_order_amount: String(promo.min_order_amount ?? 0),
      applies_to: promo.applies_to || "all",
      expires_at: promo.expires_at ? promo.expires_at.slice(0, 10) : "",
      active: promo.active !== false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Create / Edit form */}
      <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
        <div className="flex items-center gap-3">
          <span className="bg-[#1DB954]/10 text-[#1DB954] p-2.5 rounded-xl border border-[#1DB954]/25">
            <Tag size={18} />
          </span>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              {editingId ? "Edit Promo Code" : "New Promo Code"}
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {editingId ? "Update the details below." : "Create a code customers can redeem at checkout."}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Code</span>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="WELCOME10"
              disabled={Boolean(editingId)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#121212] px-3 py-2 text-sm font-bold text-white placeholder-slate-600 focus:border-[#1DB954]/50 focus:outline-none disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Discount % (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={form.discount_percent}
              onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#121212] px-3 py-2 text-sm font-bold text-white focus:border-[#1DB954]/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fixed ₱ off</span>
            <input
              type="number"
              min={0}
              value={form.discount_amount}
              onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#121212] px-3 py-2 text-sm font-bold text-white focus:border-[#1DB954]/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max uses</span>
            <input
              type="number"
              min={1}
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#121212] px-3 py-2 text-sm font-bold text-white focus:border-[#1DB954]/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min order ₱</span>
            <input
              type="number"
              min={0}
              value={form.min_order_amount}
              onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#121212] px-3 py-2 text-sm font-bold text-white focus:border-[#1DB954]/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Expires (optional)</span>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#121212] px-3 py-2 text-sm font-bold text-white focus:border-[#1DB954]/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Applies to</span>
            <select
              value={form.applies_to}
              onChange={(e) => setForm({ ...form, applies_to: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-[#121212] px-3 py-2 text-sm font-bold text-white focus:border-[#1DB954]/50 focus:outline-none"
            >
              <option value="all">All services</option>
              <option value="category:followers">Category: Followers</option>
              <option value="category:reactions">Category: Reactions</option>
              <option value="category:views">Category: Views</option>
              <option value="category:other">Category: Other</option>
            </select>
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 accent-[#1DB954]"
            />
            <span className="text-xs font-bold text-slate-400">Active</span>
          </label>
        </div>

        {result && (
          <div className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${result.success ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-red-500/25 bg-red-500/10 text-red-400"}`}>
            {result.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {result.message}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !form.code.trim()}
            className="flex items-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760] disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {editingId ? "Update" : "Create"}
          </button>
          {editingId && (
            <button
              onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-[#181818] border border-slate-850/80 rounded-2xl p-6 shadow-md">
        <h3 className="text-sm font-black uppercase tracking-wider text-white">Existing Promo Codes</h3>
        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
          {promos.length} code{promos.length === 1 ? "" : "s"} — used_count tracks redemptions.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-2.5 px-3 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Code</th>
                <th className="py-2.5 px-3 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Discount</th>
                <th className="py-2.5 px-3 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Uses</th>
                <th className="py-2.5 px-3 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Scope</th>
                <th className="py-2.5 px-3 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Expires</th>
                <th className="py-2.5 px-3 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Status</th>
                <th className="py-2.5 px-3 font-extrabold text-slate-500 text-[9px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50">
              {promos.map((promo) => (
                <tr key={promo.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-3 font-mono text-xs font-black text-white">{promo.code}</td>
                  <td className="py-3 px-3 text-xs font-bold text-slate-300">
                    {Number(promo.discount_percent) > 0 ? `${promo.discount_percent}%` : ""}
                    {Number(promo.discount_percent) > 0 && Number(promo.discount_amount) > 0 ? " + " : ""}
                    {Number(promo.discount_amount) > 0 ? `₱${promo.discount_amount}` : ""}
                  </td>
                  <td className="py-3 px-3 text-xs font-bold text-slate-300">{promo.used_count ?? 0} / {promo.max_uses ?? 1}</td>
                  <td className="py-3 px-3 text-xs font-bold text-slate-400">{promo.applies_to || "all"}</td>
                  <td className="py-3 px-3 text-xs font-bold text-slate-400">
                    {promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${promo.active ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-slate-700 bg-slate-800 text-slate-500"}`}>
                      {promo.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(promo)} title="Edit" className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white hover:border-slate-500">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleToggle(promo)} title={promo.active ? "Deactivate" : "Activate"} className={`rounded-lg border p-1.5 ${promo.active ? "border-amber-500/25 text-amber-400 hover:bg-amber-500/10" : "border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10"}`}>
                        <Power size={13} />
                      </button>
                      <button onClick={() => handleDelete(promo)} title="Delete" className="rounded-lg border border-red-500/25 p-1.5 text-red-400 hover:bg-red-500/10">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {promos.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-slate-500 italic">No promo codes yet — create one above.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
