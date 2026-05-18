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
        return <Users size={48} className="text-blue-600 mb-4" />;
      case 'reactions':
        return <ThumbsUp size={48} className="text-red-500 mb-4" />;
      case 'views':
        return <Play size={48} className="text-blue-800 mb-4" />;
      default:
        return <Users size={48} className="text-blue-600 mb-4" />;
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

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-blue-100/50 p-8 flex flex-col items-start text-left w-full border border-slate-100/50">
      <div className="h-20 flex items-center justify-center">
        {getIcon()}
      </div>
      
      <h3 className="uppercase text-sm font-bold tracking-wider text-slate-900 mb-2">{title}</h3>
      <h4 className="text-xl font-bold text-slate-900 mb-3">{iconType === 'followers' ? 'Build Your Audience' : iconType === 'reactions' ? 'Increase Engagement' : 'Maximize Exposure'}</h4>
      
      <p className="text-slate-600 text-sm leading-relaxed mb-8 flex-grow">
        {description}
      </p>
      
      <div className="flex justify-between items-end w-full mb-6">
        <div>
          <span className="block text-slate-500 text-xs font-medium mb-1">Starts (per 1000)</span>
          <span className="text-3xl font-bold text-slate-900">${Number(startingPrice).toFixed(2)}</span>
        </div>
      </div>
      
      <button 
        onClick={() => onOrder(id, title, startingPrice)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors mt-auto"
      >
        {getButtonText()}
      </button>
    </div>
  );
}
