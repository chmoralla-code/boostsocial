"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "Is this safe for my Facebook page or profile?",
    answer: "Absolutely! We only use completely standard, high-quality, organic delivery practices that fully comply with Facebook's terms of service. Your account is 100% safe and secure with us."
  },
  {
    question: "Do you require my Facebook account password?",
    answer: "Never! We will never ask for your password, login credentials, or access tokens. All we need is your public Facebook Profile URL or Post Link to deliver the followers, likes, or views."
  },
  {
    question: "How long does delivery take?",
    answer: "Amplifications typically start processing within 5 to 15 minutes after payment verification! Smaller packages are fully delivered within an hour, while larger tiers (e.g. 10,000+ followers) are naturally paced over 12-24 hours to ensure high retention."
  },
  {
    question: "How do I pay and top up my wallet balance?",
    answer: "Topping up is incredibly simple: log in to your account, click on your wallet balance in the header, select your top-up amount, and scan our GCash payment QR code. Upload a quick screenshot receipt of your payment, and our admin team will instantly approve your balance!"
  },
  {
    question: "Do you offer refunds?",
    answer: "Yes, we guarantee complete satisfaction. If an order fails to process or start, the exact order amount is immediately credited back to your digital wallet balance, which you can use to purchase other packages at any time."
  },
  {
    question: "Why is CYNETWORK safer and better than direct automated SMM panels like RixeySMM?",
    answer: "Wholesale automated panels like RixeySMM are built for raw bot-makers; they require complex payment methods (like crypto), offer zero actual customer service, and deliver unfiltered foreign spam accounts that drop rapidly and risk triggering immediate page monetization flags or bans. CYNETWORK acts as your premium local safety filter: we curate high-retention organic-profile pools, support fast local GCash top-ups, and offer direct 24-hour Taglish support from Cyrhiel Moralla to keep your campaigns 100% compliant and secure."
  }
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section className="w-full max-w-4xl mx-auto px-4 mt-20 mb-20 relative z-10">
      <div className="text-center mb-12">
        <span className="bg-[#1877F2]/10 text-[#1877F2] border border-[#1877F2]/20 font-black text-[10px] tracking-widest uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5 mb-3">
          <HelpCircle size={10} /> FAQ Portal
        </span>
        <h2 className="text-3xl md:text-4xl font-black text-center text-white tracking-tight">
          Got <span className="text-[#1877F2]">Questions</span>?
        </h2>
        <p className="text-sm text-slate-400 mt-2 font-medium">
          Everything you need to know about our services and security
        </p>
      </div>

      <div className="space-y-4">
        {FAQS.map((faq, i) => {
          const isOpen = openIdx === i;
          return (
            <div 
              key={i} 
              className="bg-[#181818]/60 border border-slate-800/80 rounded-2xl overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => toggle(i)}
                className="w-full py-5 px-6 flex items-center justify-between text-left font-bold text-white hover:bg-[#222]/30 transition-all select-none cursor-pointer"
              >
                <span className="text-sm sm:text-base pr-4">{faq.question}</span>
                <ChevronDown 
                  size={18} 
                  className={`text-[#1877F2] flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              
              <div 
                className={`transition-all duration-300 ease-in-out ${
                  isOpen ? "max-h-[300px] border-t border-slate-850 p-6 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                } overflow-hidden bg-[#121212]/30`}
              >
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">
                  {faq.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
