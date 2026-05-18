"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Edit2, Trash2, Plus, X, Users, ThumbsUp, Play } from "lucide-react";

interface Service {
  id: string;
  title: string;
  description: string;
  starting_price: number;
  icon_type: string;
  created_at?: string;
}

export function ServicesTable({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [iconType, setIconType] = useState("followers");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  const openAddModal = () => {
    setEditingService(null);
    setTitle("");
    setDescription("");
    setStartingPrice("");
    setIconType("followers");
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setTitle(service.title);
    setDescription(service.description);
    setStartingPrice(String(service.starting_price));
    setIconType(service.icon_type);
    setError("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const priceNum = Number(startingPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Please enter a valid price greater than 0");
      setLoading(false);
      return;
    }

    try {
      if (editingService) {
        // Edit flow
        const { data, error: updateErr } = await supabase
          .from("services")
          .update({
            title,
            description,
            starting_price: priceNum,
            icon_type: iconType,
          })
          .eq("id", editingService.id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        setServices(services.map(s => s.id === editingService.id ? data : s));
      } else {
        // Add flow
        const { data, error: insertErr } = await supabase
          .from("services")
          .insert([
            {
              title,
              description,
              starting_price: priceNum,
              icon_type: iconType,
            }
          ])
          .select()
          .single();

        if (insertErr) throw insertErr;

        setServices([...services, data]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to save service");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service? All linked orders may be affected!")) {
      return;
    }

    try {
      const { error: deleteErr } = await supabase
        .from("services")
        .delete()
        .eq("id", id);

      if (deleteErr) throw deleteErr;

      setServices(services.filter(s => s.id !== id));
    } catch (err: any) {
      alert("Error deleting service: " + err.message);
    }
  };

  const getIconComponent = (type: string) => {
    switch (type) {
      case "followers":
        return <Users size={20} className="text-blue-600" />;
      case "reactions":
        return <ThumbsUp size={20} className="text-red-500" />;
      case "views":
        return <Play size={20} className="text-blue-800" />;
      default:
        return <Users size={20} className="text-slate-600" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-800">Services Catalog</h2>
        <button
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Add New Service
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Icon</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Title</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Description</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Starting Price</th>
              <th className="py-4 px-6 font-semibold text-slate-700 text-sm">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services.map((service) => (
              <tr key={service.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-6 text-sm text-slate-600 whitespace-nowrap">
                  <div className="bg-slate-100 p-2.5 rounded-lg inline-flex">
                    {getIconComponent(service.icon_type)}
                  </div>
                </td>
                <td className="py-4 px-6 text-sm font-bold text-slate-900">
                  {service.title}
                </td>
                <td className="py-4 px-6 text-sm text-slate-600 max-w-sm truncate">
                  {service.description}
                </td>
                <td className="py-4 px-6 text-sm font-semibold text-slate-900">
                  ${Number(service.starting_price).toFixed(2)}
                </td>
                <td className="py-4 px-6 text-sm flex items-center gap-3">
                  <button
                    onClick={() => openEditModal(service)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Edit Service"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Delete Service"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">No services configured yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-filter backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                {editingService ? "Edit Service" : "Add New Service"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1.5 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Service Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Premium Followers"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-950 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Starting Price ($ per 1,000)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value)}
                  placeholder="e.g. 9.99"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-950 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Icon Type
                </label>
                <select
                  value={iconType}
                  onChange={(e) => setIconType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-950 font-medium cursor-pointer"
                >
                  <option value="followers">Followers (Users Icon)</option>
                  <option value="reactions">Reactions (Thumbs Up Icon)</option>
                  <option value="views">Views (Play Button Icon)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Description
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the service tier benefits and features..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-950 font-medium resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center"
                >
                  {loading ? "Saving..." : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
