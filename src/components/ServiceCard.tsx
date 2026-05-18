"use client";

import { Users, ThumbsUp, Play } from "lucide-react";

interface ServiceCardProps {
  id: string;
  title: string;
  description: string;
  startingPrice: number;
  iconType: string;
  onOrder: (serviceId: string, serviceTitle: string, startingPrice: number) => void;
}

export function ServiceCard({ id, title, description, startingPrice, iconType, onOrder }: ServiceCardProps) {
  const getIcon = () => {
    switch (iconType) {
      case 'followers':
        return <Users size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />;
      case 'reactions':
        return <ThumbsUp size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />;
      case 'views':
        return <Play size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />;
      default:
        return <Users size={40} className="text-[#1DB954] drop-shadow-[0_0_15px_rgba(29,185,84,0.3)] mb-4" />;
    }
  };

  const getButtonText = () => {
    switch (iconType) {
      case 'followers': return 'Boost Followers';
      case 'reactions': return 'Boost Reacts';
      case 'views': return 'Boost Views';
      default: return 'Order Now';
    }
  };

  const getFeatureSubtitle = () => {
    switch (iconType) {
      case 'followers': return 'Build Your Audience';
      case 'reactions': return 'Increase Engagement';
      case 'views': return 'Maximize Exposure';
      default: return 'Instant Amplification';
    }
  };

  return (
    <div className="bg-[#181818] hover:bg-[#282828] rounded-2xl p-8 flex flex-col items-start text-left w-full border border-slate-800/40 hover:border-slate-700/60 shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 group">
      <div className="h-16 flex items-center justify-center">
        {getIcon()}
      </div>
      
      <h3 className="uppercase text-xs font-black tracking-widest text-slate-500 mb-2">{title}</h3>
      <h4 className="text-xl font-bold text-white mb-3 group-hover:text-[#1DB954] transition-colors">{getFeatureSubtitle()}</h4>
      
      <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-grow">
        {description}
      </p>
      
      <div className="flex justify-between items-end w-full mb-6 pt-4 border-t border-slate-800/60">
        <div>
          <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Starts (per 1,000)</span>
          <span className="text-3xl font-black text-white">${Number(startingPrice).toFixed(2)}</span>
        </div>
      </div>
      
      <button 
        onClick={() => onOrder(id, title, startingPrice)}
        className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-3.5 rounded-full transition-all duration-300 uppercase text-xs tracking-wider transform group-hover:scale-[1.02] shadow-lg shadow-green-500/5"
      >
        {getButtonText()}
      </button>
    </div>
  );
}
