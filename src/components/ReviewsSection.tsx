"use client";

import { useState, useEffect } from "react";
import { Star, MessageSquarePlus, PenTool, CheckCircle } from "lucide-react";

interface Review {
  id: string;
  name: string;
  rating: number;
  content: string;
  date: string;
  isCustom?: boolean;
}

const STATIC_REVIEWS: Review[] = [
  {
    id: "rev-1",
    name: "Harold S.",
    rating: 5,
    content: "Sobrang bilis! Subsub ko lang yung link for 1k followers tapos wala pang 10 mins nagdadatingan na agad. Salamat FaceBoosting! 🌟",
    date: "May 15, 2026"
  },
  {
    id: "rev-2",
    name: "Jenny Rose M.",
    rating: 5,
    content: "Highly recommended for business pages. Instant views on my FB Reels! Tested the 50 free followers first, it works instantly! Will buy again.",
    date: "May 12, 2026"
  },
  {
    id: "rev-3",
    name: "Arnel P.",
    rating: 5,
    content: "Excellent service. Stable and non-drop accounts. Very safe for my account, no password required. 5/5 stars!",
    date: "May 09, 2026"
  },
  {
    id: "rev-4",
    name: "Liza B.",
    rating: 4,
    content: "Super cheap price compared to Facebook ads. The likes and heart reactions are high quality. CS AI is very fast too.",
    date: "May 06, 2026"
  }
];

export function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>(STATIC_REVIEWS);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Load custom reviews from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("custom_reviews");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Review[];
          setReviews([...parsed, ...STATIC_REVIEWS]);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;

    const newReview: Review = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      rating,
      content: content.trim(),
      date: "Just now",
      isCustom: true
    };

    const updatedCustom = [newReview];
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("custom_reviews");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          updatedCustom.push(...parsed);
        } catch (e) {}
      }
      localStorage.setItem("custom_reviews", JSON.stringify(updatedCustom));
    }

    setReviews([newReview, ...reviews]);
    setSubmitted(true);
    setTimeout(() => {
      setShowForm(false);
      setName("");
      setRating(5);
      setContent("");
      setSubmitted(false);
    }, 2000);
  };

  return (
    <section className="w-full max-w-5xl mx-auto px-4 mt-20 mb-24 relative z-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-12">
        <div className="text-left">
          <span className="bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20 font-black text-[10px] tracking-widest uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3">
            <Star size={10} fill="currentColor" /> Reviews Grid
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-fg tracking-tight">
            Client <span className="text-[#1877F2]">Success Stories</span>
          </h2>
          <p className="text-sm text-muted mt-2 font-medium">
            Real feedback from creators, influencers, and business pages
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-card hover:bg-elevated border border-border/80 text-fg font-extrabold py-3 px-6 rounded-full transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer self-start sm:self-center"
        >
          <MessageSquarePlus size={14} className="text-[#1877F2]" /> Write A Review
        </button>
      </div>

      {/* Review Builder Form */}
      {showForm && (
        <div className="bg-card border border-border/80 rounded-2xl p-6 mb-8 max-w-xl mx-auto text-left relative animate-in slide-in-from-top-4 duration-300">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <div className="text-[#1877F2] animate-bounce">
                <CheckCircle size={36} />
              </div>
              <h4 className="text-base font-black text-fg">Review Submitted!</h4>
              <p className="text-xs text-muted">Thank you for sharing your experience live!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h4 className="text-sm font-black text-fg uppercase tracking-wider flex items-center gap-2 mb-2">
                <PenTool size={14} className="text-[#1877F2]" /> Share Your Experience
              </h4>
              
              <div>
                <label className="block text-[10px] font-black uppercase text-muted mb-1.5">Your Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Clara"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-elevated border border-border rounded-xl text-fg focus:outline-none focus:ring-1 focus:ring-primary text-xs font-semibold placeholder-muted"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-muted mb-1.5">Rating (1 to 5 Stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="text-muted hover:text-yellow-400 transition-colors p-1"
                    >
                      <Star 
                        size={22} 
                        fill={star <= rating ? "#eab308" : "none"} 
                        className={star <= rating ? "text-yellow-500" : "text-muted"}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-muted mb-1.5">Feedback message</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tell others how fast and reliable our boosting was..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-2.5 bg-elevated border border-border rounded-xl text-fg focus:outline-none focus:ring-1 focus:ring-primary text-xs font-medium placeholder-muted resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs font-bold text-muted hover:text-fg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary-dark text-white font-black py-2.5 px-6 rounded-full shadow-lg transition-all text-xs uppercase tracking-wider"
                >
                  Submit Review
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {reviews.map((rev) => (
          <div 
            key={rev.id} 
            className="bg-card/60 border border-border/80 rounded-2xl p-5 hover:bg-elevated/30 transition-all duration-300 flex flex-col justify-between text-left group"
          >
            <div className="space-y-3">
              {/* Star Rating */}
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star 
                    key={s} 
                    size={14} 
                    fill={s <= rev.rating ? "#1877F2" : "none"} 
                    className={s <= rev.rating ? "text-[#1877F2]" : "text-muted"} 
                  />
                ))}
              </div>
              
              {/* Comment */}
              <p className="text-fg text-xs font-medium leading-relaxed italic">
                "{rev.content}"
              </p>
            </div>

            {/* Author */}
            <div className="border-t border-border/60 mt-5 pt-3.5 flex items-center justify-between">
              <span className="text-xs font-black text-fg">{rev.name}</span>
              <span className="text-[9px] text-muted font-bold uppercase">{rev.date}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
