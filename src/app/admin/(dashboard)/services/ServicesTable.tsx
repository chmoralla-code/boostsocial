"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Edit2, Trash2, Plus, X, Users, ThumbsUp, Play, Search, DollarSign, Settings, Layers, Image as ImageIcon, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { compressImage } from "@/utils/imageCompressor";
import { parseDescription } from "@/utils/serviceHelpers";

interface Service {
  id: string;
  title: string;
  description: any;
  starting_price: number;
  icon_type: string;
  created_at?: string;
}

export function ServicesTable({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [searchTerm, setSearchTerm] = useState("");
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
  const [customCaption, setCustomCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customIconFile, setCustomIconFile] = useState<File | null>(null);
  const [customFields, setCustomFields] = useState<{id: string, label: string}[]>([]);

  // SMM metadata fields
  const [smmServiceId, setSmmServiceId] = useState("");
  const [smmOriginalRate, setSmmOriginalRate] = useState("");
  const [smmMarkupPercent, setSmmMarkupPercent] = useState("");
  const [smmOriginalName, setSmmOriginalName] = useState("");
  const [smmMin, setSmmMin] = useState("");
  const [smmMax, setSmmMax] = useState("");

  // Search & Map SMM Services selector
  interface SmmService {
    id: string;
    name: string;
    category: string;
    originalRate: number;
    ratePer1k: number;
    startingPrice: number;
    min: number;
    max: number;
    desc: string;
  }
  const [smmServicesList, setSmmServicesList] = useState<SmmService[]>([]);
  const [smmSearchTerm, setSmmSearchTerm] = useState("");
  const [smmLoading, setSmmLoading] = useState(false);
  const [showSmmDropdown, setShowSmmDropdown] = useState(false);

  const fetchSmmServicesList = async () => {
    if (smmServicesList.length > 0) return;
    setSmmLoading(true);
    try {
      const res = await fetch("/api/smm/services");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSmmServicesList(data);
      }
    } catch (e) {
      console.error("Failed to fetch RixeySMM services list:", e);
    } finally {
      setSmmLoading(false);
    }
  };

  const supabase = createClient();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [rowSyncingId, setRowSyncingId] = useState<string | null>(null);

  const handleSyncSmmServices = async () => {
    setIsSyncing(true);
    setSyncMessage("Syncing RixeySMM services and rates...");
    try {
      const res = await fetch("/api/admin/sync-smm-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markupPercent: 90 }), // default 90% markup
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync SMM services");
      }
      
      // Success! Reload services
      const { data: dbData, error: dbErr } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: true });
         
      if (dbErr) throw dbErr;
      if (dbData) {
        setServices(dbData);
      }
    } catch (err: any) {
      alert("Sync error: " + err.message);
    } finally {
      setIsSyncing(false);
      setSyncMessage("");
    }
  };

  const handleSyncSingleService = async (serviceId: string) => {
    setRowSyncingId(serviceId);
    try {
      const res = await fetch("/api/admin/sync-smm-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          markupPercent: 90,
          serviceId: serviceId 
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync service");
      }
      
      const { data: dbData, error: dbErr } = await supabase
        .from("services")
        .select("*")
        .eq("id", serviceId)
        .single();
         
      if (dbErr) throw dbErr;
      if (dbData) {
        setServices(prev => prev.map(s => s.id === serviceId ? dbData : s));
        alert(`Successfully synced ${dbData.title} cheapest rate!`);
      }
    } catch (err: any) {
      alert("Sync error: " + err.message);
    } finally {
      setRowSyncingId(null);
    }
  };

  const openAddModal = () => {
    setEditingService(null);
    setTitle("");
    setDescription("");
    setSubtitle("");
    setButtonText("");
    setMinQuantity("100");
    setFreeTrialAmount("50");
    setCustomCaption("");
    setStartingPrice("");
    setIconType("followers");
    setCustomIconFile(null);
    setCustomFields([]);
    setError("");
    setSmmServiceId("");
    setSmmOriginalRate("");
    setSmmMarkupPercent("");
    setSmmOriginalName("");
    setSmmMin("");
    setSmmMax("");
    setSmmSearchTerm("");
    fetchSmmServicesList();
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setTitle(service.title);
    setStartingPrice(String(service.starting_price));
    setIconType(service.icon_type);
    setCustomIconFile(null);
    setError("");
    const rawDesc = typeof service.description === "string" ? service.description : "";

    const defaults = {
      description: service.description,
      subtitle: "",
      button_text: "",
      min_quantity: 100,
      free_trial_amount: 50,
      custom_caption: "",
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
      case "automation":
        defaults.subtitle = "Queue Content Faster";
        defaults.button_text = "Build Queue";
        break;
      default:
        defaults.subtitle = "Instant Amplification";
        defaults.button_text = "Order Now";
        break;
    }

    try {
      const parsed = parseDescription(service.description);
      if (parsed) {
        setDescription(parsed.description || defaults.description);
        setSubtitle(parsed.subtitle || defaults.subtitle);
        setButtonText(parsed.button_text || defaults.button_text);
        setMinQuantity(String(parsed.min_quantity) || String(defaults.min_quantity));
        setFreeTrialAmount(String(parsed.free_trial_amount) || String(defaults.free_trial_amount));
        setCustomCaption(parsed.custom_caption || "");
        setCustomFields(parsed.custom_fields || []);
        
        // SMM properties
        setSmmServiceId(parsed.smm_service_id ? String(parsed.smm_service_id) : "");
        setSmmOriginalRate(parsed.smm_original_rate !== undefined ? String(parsed.smm_original_rate) : "");
        setSmmMarkupPercent(parsed.smm_markup_percent !== undefined ? String(parsed.smm_markup_percent) : "");
        setSmmOriginalName(parsed.smm_original_name || "");
        setSmmMin(parsed.smm_min !== undefined ? String(parsed.smm_min) : "");
        setSmmMax(parsed.smm_max !== undefined ? String(parsed.smm_max) : "");
      } else {
        setDescription(rawDesc);
        setSubtitle(defaults.subtitle);
        setButtonText(defaults.button_text);
        setMinQuantity(String(defaults.min_quantity));
        setFreeTrialAmount(String(defaults.free_trial_amount));
        setCustomCaption("");
        setCustomFields([]);
        
        setSmmServiceId("");
        setSmmOriginalRate("");
        setSmmMarkupPercent("");
        setSmmOriginalName("");
        setSmmMin("");
        setSmmMax("");
      }
    } catch (e) {
      const rawDesc = typeof service.description === "string" ? service.description : "";
      setDescription(rawDesc);
      setSubtitle(defaults.subtitle);
      setButtonText(defaults.button_text);
      setMinQuantity(String(defaults.min_quantity));
      setFreeTrialAmount(String(defaults.free_trial_amount));
      setCustomCaption("");
      setCustomFields([]);
      
      setSmmServiceId("");
      setSmmOriginalRate("");
      setSmmMarkupPercent("");
      setSmmOriginalName("");
      setSmmMin("");
      setSmmMax("");
    }

    const parsed = parseDescription(service.description);
    setSmmSearchTerm(parsed?.smm_original_name || "");
    fetchSmmServicesList();
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

    let finalIconType = iconType;

    if (customIconFile) {
      try {
        // Compress client-side to ensure small footprint (max 200px dimension since it's an icon!)
        const compressedIcon = await compressImage(customIconFile, 200, 0.8);
        const iconFormData = new FormData();
        iconFormData.append("file", compressedIcon);
        if (editingService?.id) {
          iconFormData.append("serviceId", editingService.id);
        }
        
        const uploadRes = await fetch("/api/admin/upload-service-icon", {
          method: "POST",
          body: iconFormData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Icon upload failed");
        }
        finalIconType = uploadData.url;
      } catch (e: any) {
        setError("Failed uploading custom icon: " + e.message);
        setLoading(false);
        return;
      }
    }

    const packedDescription = JSON.stringify({
      description: description.trim(),
      subtitle: subtitle.trim(),
      button_text: buttonText.trim(),
      min_quantity: Number(minQuantity) || 100,
      free_trial_amount: Number(freeTrialAmount) || 50,
      custom_caption: customCaption.trim(),
      custom_fields: customFields,
      smm_service_id: smmServiceId ? smmServiceId.trim() : undefined,
      smm_original_rate: smmOriginalRate ? Number(smmOriginalRate) : undefined,
      smm_markup_percent: smmMarkupPercent ? Number(smmMarkupPercent) : undefined,
      smm_original_name: smmOriginalName ? smmOriginalName.trim() : undefined,
      smm_min: smmMin ? Number(smmMin) : undefined,
      smm_max: smmMax ? Number(smmMax) : undefined,
    });

    const smmMetadata = {
      smm_service_id: smmServiceId ? smmServiceId.trim() : "",
      smm_original_rate: smmOriginalRate ? Number(smmOriginalRate) : undefined,
      smm_markup_percent: smmMarkupPercent ? Number(smmMarkupPercent) : undefined,
      smm_original_name: smmOriginalName ? smmOriginalName.trim() : "",
      smm_min: smmMin ? Number(smmMin) : undefined,
      smm_max: smmMax ? Number(smmMax) : undefined,
    };

    try {
      const res = await fetch("/api/admin/save-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingService?.id,
          title,
          description: packedDescription,
          starting_price: priceNum,
          icon_type: finalIconType,
          smmMetadata,
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
    if (type && (type.startsWith("http") || type.startsWith("data:image"))) {
      return (
        <img 
          src={type} 
          alt="Custom Icon" 
          className="w-5 h-5 object-contain"
        />
      );
    }
    switch (type) {
      case "followers":
        return <Users size={18} className="text-blue-400" />;
      case "reactions":
        return <ThumbsUp size={18} className="text-red-400" />;
      case "views":
        return <Play size={18} className="text-[#1DB954]" />;
      case "automation":
        return <Sparkles size={18} className="text-blue-400" />;
      default:
        return <Users size={18} className="text-slate-400" />;
    }
  };

  // Dynamically calculate aggregate metadata values
  const totalTiers = services.length;
  const highestPriceService = services.length > 0 
    ? [...services].sort((a, b) => b.starting_price - a.starting_price)[0]
    : null;
  const categoryCounts = services.reduce((acc, s) => {
    const key = s.icon_type.startsWith("http") ? "custom" : s.icon_type;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const dominantCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

  // Filter lists based on Search input
  const filteredServices = services.filter(s => {
    const rawDesc = typeof s.description === 'string' ? s.description : '';
    const parsed = parseDescription(s.description);
    const descText = parsed ? (parsed.description || '') : rawDesc;
    return s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      descText.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 text-slate-300">
      {/* Dynamic Telemetry Aggregates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#181818] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#1DB954]/5 rounded-full pointer-events-none -mr-8 -mt-8 group-hover:bg-[#1DB954]/10 transition-colors duration-300"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Total Services Tiers</span>
            <div className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 p-2 rounded-xl">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white tracking-tight">{totalTiers}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Configured catalog tiers</p>
          </div>
        </div>

        <div className="bg-[#181818] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full pointer-events-none -mr-8 -mt-8 group-hover:bg-blue-500/10 transition-colors duration-300"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Highest Pricing Tier</span>
            <div className="bg-blue-500/10 text-blue-400 border border-blue-500/25 p-2 rounded-xl">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-blue-400 tracking-tight">
              {highestPriceService ? `₱${Number(highestPriceService.starting_price).toFixed(2)}` : "₱0.00"}
            </h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider truncate">
              {highestPriceService ? highestPriceService.title : "No services configured"}
            </p>
          </div>
        </div>

        <div className="bg-[#181818] border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden group shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full pointer-events-none -mr-8 -mt-8 group-hover:bg-purple-500/10 transition-colors duration-300"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Popular Focus</span>
            <div className="bg-purple-500/10 text-purple-400 border border-purple-500/25 p-2 rounded-xl">
              <Settings size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-purple-400 tracking-tight capitalize">{dominantCategory}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Most frequent service type</p>
          </div>
        </div>
      </div>

      {/* Control Actions & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#181818] p-4 rounded-2xl border border-slate-800/80 shadow-md">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search service catalog..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 transition-all text-slate-200 font-medium placeholder-slate-500"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={handleSyncSmmServices}
            disabled={isSyncing}
            className="w-full sm:w-auto bg-transparent border border-[#1DB954] hover:bg-[#1DB954]/10 disabled:bg-slate-800 text-[#1DB954] disabled:text-slate-500 font-extrabold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-md active:scale-95"
          >
            <RefreshCw size={16} className={`${isSyncing ? "animate-spin" : ""}`} /> Sync SMM Rates
          </button>
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-md active:scale-95 font-bold"
          >
            <Plus size={16} strokeWidth={3} /> Add New Service
          </button>
        </div>
      </div>

      {/* Services Table Content */}
      <div className="bg-[#181818] rounded-2xl shadow-lg border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1c1c1c] border-b border-slate-850/60">
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider w-20">Icon</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider">Service Title</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider">Config Description</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider w-44">Starting Price</th>
                <th className="py-4 px-6 font-extrabold text-slate-400 text-xs uppercase tracking-wider text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/50">
              {filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-4 px-6 text-sm text-slate-400 whitespace-nowrap">
                    <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700/35 inline-flex shadow-sm">
                      {getIconComponent(service.icon_type)}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-white tracking-tight">
                    <div>{service.title}</div>
                    {(() => {
                      try {
                        const parsed = parseDescription(service.description);
                        if (parsed && parsed.smm_service_id) {
                          return (
                            <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                              <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-[#1DB954] px-2 py-0.5 rounded-full font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-sm">
                                <Layers size={9} strokeWidth={3} /> SMM ID: {parsed.smm_service_id}
                              </span>
                              {parsed.smm_original_rate !== undefined && (
                                <span className="text-[9px] bg-slate-800 border border-slate-700/85 text-slate-400 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                                  <DollarSign size={9} /> Reseller: ₱{Number(parsed.smm_original_rate).toFixed(2)}/1k
                                </span>
                              )}
                              {parsed.smm_original_name && (
                                <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold max-w-[220px] truncate inline-block" title={parsed.smm_original_name}>
                                  {parsed.smm_original_name}
                                </span>
                              )}
                            </div>
                          );
                        }
                      } catch (e) {}
                      return null;
                    })()}
                  </td>
                  <td className="py-4 px-6 text-xs text-slate-400 max-w-md truncate">
                    {(() => {
                      try {
                        const parsed = parseDescription(service.description);
                        if (parsed) {
                          return parsed.description || "";
                        }
                      } catch (e) {}
                      return typeof service.description === "string" ? service.description : "";
                    })()}
                  </td>
                  <td className="py-4 px-6 text-sm font-extrabold text-[#1DB954] whitespace-nowrap">
                    ₱{Number(service.starting_price).toFixed(2)
                    } <span className="text-[10px] text-slate-500 font-bold uppercase">/ pc</span>
                  </td>
                  <td className="py-4 px-6 text-sm text-right whitespace-nowrap space-x-2">
                    <button
                      onClick={() => handleSyncSingleService(service.id)}
                      disabled={rowSyncingId === service.id}
                      className="px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/15 hover:border-blue-500/30 hover:bg-blue-500/20 text-blue-400 disabled:text-slate-500 disabled:border-slate-800 rounded-lg transition-all text-xs font-bold inline-flex items-center gap-1.5"
                      title="Sync Cheapest Rate"
                    >
                      {rowSyncingId === service.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RefreshCw size={13} />
                      )}
                      Sync Cheapest
                    </button>
                    <button
                      onClick={() => openEditModal(service)}
                      className="px-2.5 py-1.5 bg-[#1DB954]/10 border border-[#1DB954]/15 hover:border-[#1DB954]/30 hover:bg-[#1DB954]/25 text-[#1DB954] rounded-lg transition-all text-xs font-bold inline-flex items-center gap-1.5"
                      title="Edit Service"
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/15 hover:border-red-500/30 hover:bg-red-500/20 text-red-400 rounded-lg transition-all text-xs font-bold inline-flex items-center gap-1.5"
                      title="Delete Service"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-sm font-semibold">
                    No services configured inside catalog.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Glassmorphic Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-slate-800/80 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative transform transition-all animate-in zoom-in-95 duration-200 text-slate-350 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-850/60 mb-6">
              <h3 className="text-lg font-black text-white">
                {editingService ? "Edit Service Tier" : "Add New Service Tier"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 text-red-400 px-4 py-3 rounded-xl text-xs font-bold border border-red-500/20 uppercase tracking-wide">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                    Service Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Premium Followers"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-bold transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between">
                    <span>Price Per PCS (₱)</span>
                    <span className="text-[8px] text-[#1DB954] font-bold uppercase tracking-wider">Per single item rate</span>
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    placeholder="e.g. 0.2490"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-[#1DB954] font-black transition-all text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                    Icon Selection
                  </label>
                  <select
                    value={iconType.startsWith("http") ? "custom" : iconType}
                    onChange={(e) => {
                      if (e.target.value !== "custom") {
                        setIconType(e.target.value);
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-bold cursor-pointer text-sm"
                  >
                    <option value="followers">Followers (Users Icon)</option>
                    <option value="reactions">Reactions (Thumbs Up Icon)</option>
                    <option value="views">Views (Play Button Icon)</option>
                    <option value="automation">Automation (Sparkles Icon)</option>
                    {iconType.startsWith("http") && (
                      <option value="custom">Custom PNG Upload (Current)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <span>Upload PNG Icon</span>
                    <span className="text-[8px] bg-blue-500/20 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Overrides</span>
                  </label>
                  <div className="flex items-center gap-3 bg-[#121212] px-3 py-2 rounded-xl border border-slate-850/60">
                    <div className="flex-1 overflow-hidden">
                      <input 
                        type="file" 
                        accept="image/png"
                        onChange={(e) => setCustomIconFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-[#1DB954]/10 file:text-[#1DB954] hover:file:bg-[#1DB954]/25 file:cursor-pointer cursor-pointer transition-colors"
                      />
                    </div>
                    {customIconFile && (
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shadow-sm flex-shrink-0 flex items-center justify-center">
                        <img 
                          src={URL.createObjectURL(customIconFile)} 
                          alt="Preview" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {customIconFile && (
                <p className="text-[10px] text-[#1DB954] font-black uppercase tracking-wider flex items-center gap-1.5 mt-1 bg-[#1DB954]/5 px-3 py-1.5 rounded-lg border border-[#1DB954]/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse"></span>
                  Custom PNG attached & optimized via client-side PNG compressor
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                    Feature Subtitle
                  </label>
                  <input
                    type="text"
                    required
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="e.g. Build Your Audience"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-bold transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                    Button Action Text
                  </label>
                  <input
                    type="text"
                    required
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    placeholder="e.g. Boost Followers"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-bold transition-all text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                    Min Quantity
                  </label>
                  <input
                    type="number"
                    required
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-bold transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                    Free Trial Amount
                  </label>
                  <input
                    type="number"
                    required
                    value={freeTrialAmount}
                    onChange={(e) => setFreeTrialAmount(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-bold transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between">
                  <span>Custom Price Caption</span>
                  <span className="text-[8px] text-slate-500 font-normal normal-case">Use {"{min_quantity}"} to insert minimum quantity</span>
                </label>
                <input
                  type="text"
                  value={customCaption}
                  onChange={(e) => setCustomCaption(e.target.value)}
                  placeholder="e.g. For as low as {min_quantity} quantity followers (Leave blank for default)"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-medium transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
                  Detailed Catalog Description
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the service tier benefits and features..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#121212] border border-slate-850/60 focus:outline-none focus:border-[#1DB954]/55 focus:ring-1 focus:ring-[#1DB954]/25 text-white font-medium resize-none text-sm"
                />
              </div>

              {/* Premium SMM reseller sync metadata layout */}
              <div className="bg-[#121212]/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Settings size={14} className="text-[#1DB954]" />
                    SMM Reseller Sync Integration
                  </span>
                  <span className="text-[8px] bg-[#1DB954]/10 border border-[#1DB954]/20 text-[#1DB954] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Optional
                  </span>
                </div>

                {/* Search & Map Combobox */}
                <div className="space-y-1 relative">
                  <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1 flex justify-between items-center">
                    <span>Search & Select RixeySMM Service</span>
                    {smmLoading && <Loader2 size={10} className="animate-spin text-[#1DB954]" />}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={smmLoading ? "Loading reseller catalog..." : "Type to search SMM services..."}
                      disabled={smmLoading}
                      value={smmSearchTerm}
                      onChange={(e) => {
                        setSmmSearchTerm(e.target.value);
                        setShowSmmDropdown(true);
                      }}
                      onFocus={() => setShowSmmDropdown(true)}
                      onBlur={() => setTimeout(() => setShowSmmDropdown(false), 200)}
                      className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-slate-800 focus:outline-none focus:border-[#1DB954]/55 text-white text-xs placeholder-slate-500"
                    />
                    
                    {showSmmDropdown && smmServicesList.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-[#181818] border border-slate-800 rounded-lg shadow-xl max-h-[180px] overflow-y-auto divide-y divide-slate-850/50">
                        {smmServicesList
                          .filter(s => 
                            s.name.toLowerCase().includes(smmSearchTerm.toLowerCase()) || 
                            s.category.toLowerCase().includes(smmSearchTerm.toLowerCase()) ||
                            s.id.toString().includes(smmSearchTerm)
                          )
                          .slice(0, 40)
                          .map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSmmServiceId(String(s.id));
                                setSmmOriginalRate(String(s.originalRate));
                                setSmmOriginalName(s.name);
                                setSmmMin(String(s.min));
                                setSmmMax(String(s.max));
                                setStartingPrice(s.startingPrice.toFixed(4));
                                setSmmSearchTerm(s.name);
                                setShowSmmDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#1DB954]/10 transition-colors text-[10px] text-slate-350 hover:text-white"
                            >
                              <div className="font-extrabold flex justify-between">
                                <span>ID {s.id}: {s.name}</span>
                                <span className="text-[#1DB954] font-black">₱{s.originalRate}/1k</span>
                              </div>
                              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                {s.category} | Auto Price: ₱{s.startingPrice.toFixed(4)}/pc
                              </div>
                            </button>
                          ))}
                        {smmServicesList.filter(s => 
                          s.name.toLowerCase().includes(smmSearchTerm.toLowerCase()) || 
                          s.category.toLowerCase().includes(smmSearchTerm.toLowerCase()) ||
                          s.id.toString().includes(smmSearchTerm)
                        ).length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-500 font-semibold">
                            No matching services found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                      SMM Service ID
                    </label>
                    <input
                      type="text"
                      value={smmServiceId}
                      onChange={(e) => setSmmServiceId(e.target.value)}
                      placeholder="e.g. 2983"
                      className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-slate-800/80 focus:outline-none focus:border-[#1DB954]/55 text-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                      SMM Reseller Cost (₱/1k)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={smmOriginalRate}
                      onChange={(e) => setSmmOriginalRate(e.target.value)}
                      placeholder="e.g. 9.96"
                      className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-slate-800/80 focus:outline-none focus:border-[#1DB954]/55 text-white font-bold text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                      Markup (%)
                    </label>
                    <input
                      type="number"
                      value={smmMarkupPercent}
                      onChange={(e) => setSmmMarkupPercent(e.target.value)}
                      placeholder="60"
                      className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-slate-800/80 focus:outline-none focus:border-[#1DB954]/55 text-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                      Min SMM Qty
                    </label>
                    <input
                      type="number"
                      value={smmMin}
                      onChange={(e) => setSmmMin(e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-slate-800/80 focus:outline-none focus:border-[#1DB954]/55 text-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                      Max SMM Qty
                    </label>
                    <input
                      type="number"
                      value={smmMax}
                      onChange={(e) => setSmmMax(e.target.value)}
                      placeholder="100000"
                      className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-slate-800/80 focus:outline-none focus:border-[#1DB954]/55 text-white font-bold text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mb-1">
                    SMM Original Name
                  </label>
                  <input
                    type="text"
                    value={smmOriginalName}
                    onChange={(e) => setSmmOriginalName(e.target.value)}
                    placeholder="e.g. Facebook Followers | Global"
                    className="w-full px-3 py-2 rounded-lg bg-[#181818] border border-slate-800/80 focus:outline-none focus:border-[#1DB954]/55 text-white text-xs truncate"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2 flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    Custom Form Fields 
                    <span className="text-[8px] bg-[#1DB954]/10 border border-[#1DB954]/20 text-[#1DB954] px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-widest">Interactive Form</span>
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setCustomFields([...customFields, { id: crypto.randomUUID(), label: "" }])}
                    className="text-[9px] bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 font-black px-2 py-1 rounded-lg flex items-center gap-1 uppercase tracking-wider transition-colors"
                  >
                    <Plus size={10} strokeWidth={2.5} /> Add Form Input
                  </button>
                </label>
                
                {customFields.length === 0 ? (
                  <div className="text-[10px] font-extrabold text-slate-500 bg-[#121212] border border-slate-800 border-dashed rounded-xl p-3.5 text-center uppercase tracking-wider">
                    No custom fields. The default "Target Link / URL" will be requested.
                  </div>
                ) : (
                  <div className="space-y-2 bg-[#121212] p-2.5 rounded-xl border border-slate-850/60 max-h-[140px] overflow-y-auto">
                    {customFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center bg-[#181818] p-1.5 rounded-lg border border-slate-800/80 shadow-sm animate-in slide-in-from-right-2">
                        <div className="bg-slate-800 text-slate-400 font-extrabold px-2 py-1 rounded text-[10px] flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            required
                            value={field.label}
                            onChange={(e) => {
                              const newFields = [...customFields];
                              newFields[index].label = e.target.value;
                              setCustomFields(newFields);
                            }}
                            placeholder="e.g. Enter your Roblox Username"
                            className="w-full px-2 py-1 bg-transparent border-none focus:outline-none focus:ring-0 text-xs text-white font-bold placeholder:text-slate-655 font-medium"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newFields = [...customFields];
                            newFields.splice(index, 1);
                            setCustomFields(newFields);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors flex-shrink-0"
                          title="Remove Field"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-850/60">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-transparent hover:bg-slate-800/40 border border-slate-800 text-slate-400 hover:text-white font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-slate-800 text-black font-extrabold py-2.5 rounded-xl transition-all flex items-center justify-center text-xs uppercase tracking-wider"
                >
                  {loading ? "Saving..." : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Syncing Overlay Spinner */}
      {isSyncing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-slate-800/80 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-[#1DB954]/10 border border-[#1DB954]/20 text-[#1DB954] rounded-full flex items-center justify-center mx-auto animate-spin">
              <RefreshCw size={24} />
            </div>
            <div>
              <p className="text-base font-bold text-white uppercase tracking-wider">Syncing SMM Rates</p>
              <p className="text-xs text-slate-400 mt-1">{syncMessage}</p>
            </div>
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest bg-[#121212] p-2.5 rounded-xl border border-slate-800 animate-pulse">
              Syncing cheapest RixeySMM candidates...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
