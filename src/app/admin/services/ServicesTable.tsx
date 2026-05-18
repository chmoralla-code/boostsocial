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
  const [subtitle, setSubtitle] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [minQuantity, setMinQuantity] = useState("100");
  const [freeTrialAmount, setFreeTrialAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  const openAddModal = () => {
    setEditingService(null);
    setTitle("");
    setDescription("");
    setSubtitle("");
    setButtonText("");
    setMinQuantity("100");
    setFreeTrialAmount("50");
    setStartingPrice("");
    setIconType("followers");
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setTitle(service.title);
    setStartingPrice(String(service.starting_price));
    setIconType(service.icon_type);
    setError("");

    const defaults = {
      description: service.description,
      subtitle: "",
      button_text: "",
      min_quantity: 100,
      free_trial_amount: 50,
    };

    switch (service.icon_type) {
      case "followers":
        defaults.subtitle = "Build Your Audience";
        defaults.button_text = "Boost Followers";
        break;
      case "reactions":
        defaults.subtitle = "Increase Engagement";
        defaults.button_text = "Boost Reacts";
        break;
      case "views":
        defaults.subtitle = "Maximize Exposure";
        defaults.button_text = "Boost Views";
        break;
      default:
        defaults.subtitle = "Instant Amplification";
        defaults.button_text = "Order Now";
        break;
    }

    try {
      if (service.description && service.description.trim().startsWith("{")) {
        const parsed = JSON.parse(service.description);
        setDescription(parsed.description || defaults.description);
        setSubtitle(parsed.subtitle || defaults.subtitle);
        setButtonText(parsed.button_text || defaults.button_text);
        setMinQuantity(String(parsed.min_quantity) || String(defaults.min_quantity));
        setFreeTrialAmount(String(parsed.free_trial_amount) || String(defaults.free_trial_amount));
      } else {
        setDescription(service.description);
        setSubtitle(defaults.subtitle);
        setButtonText(defaults.button_text);
        setMinQuantity(String(defaults.min_quantity));
        setFreeTrialAmount(String(defaults.free_trial_amount));
      }
    } catch (e) {
      setDescription(service.description);
      setSubtitle(defaults.subtitle);
      setButtonText(defaults.button_text);
      setMinQuantity(String(defaults.min_quantity));
      setFreeTrialAmount(String(defaults.free_trial_amount));
    }
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

    const packedDescription = JSON.stringify({
      description: description.trim(),
      subtitle: subtitle.trim(),
      button_text: buttonText.trim(),
      min_quantity: Number(minQuantity) || 100,
      free_trial_amount: Number(freeTrialAmount) || 50,
    });

    try {
      const res = await fetch("/api/admin/save-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingService?.id,
          title,
          description: packedDescription,
          starting_price: priceNum,
          icon_type: iconType,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save service");

      if (editingService) {
        setServices(services.map(s => s.id === editingService.id ? data.service : s));
      } else {
        setServices([...services, data.service]);
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
      const res = await fetch("/api/admin/delete-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete service");

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
                  {(() => {
                    try {
                      if (service.description && service.description.trim().startsWith("{")) {
                        return JSON.parse(service.description).description || service.description;
                      }
                    } catch (e) {}
                    return service.description;
                  })()}
                </td>
                <td className="py-4 px-6 text-sm font-semibold text-slate-900">
                  ₱{Number(service.starting_price).toFixed(2)}
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
                  Starting Price (₱ per 1,000)
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
                  Feature Subtitle (e.g. Build Your Audience)
                </label>
                <input
                  type="text"
                  required
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g. Build Your Audience"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-950 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Button Text (e.g. Boost Followers)
                </label>
                <input
                  type="text"
                  required
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="e.g. Boost Followers"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-950 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Min Quantity
                  </label>
                  <input
                    type="number"
                    required
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-950 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Free Trial Amount
                  </label>
                  <input
                    type="number"
                    required
                    value={freeTrialAmount}
                    onChange={(e) => setFreeTrialAmount(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-slate-950 font-medium"
                  />
                </div>
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
