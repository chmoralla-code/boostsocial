"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Image } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

declare global {
  interface Window {
    puter?: any;
  }
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const parseMorallaName = (text: string, isUser: boolean) => {
  const parts = [];
  const regex = /Cyrhiel Moralla/gi;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`moralla-${match.index}`}
        href="https://www.facebook.com/profile.php?id=61584774638218"
        target="_blank"
        rel="noopener noreferrer"
        className={`underline hover:text-[#4e8df5] font-black transition-colors ${
          isUser ? 'text-white' : 'text-[#1877F2]'
        }`}
      >
        {match[0]}
      </a>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
};

const renderMessageContent = (content: string, isUser: boolean) => {
  const lines = content.split('\n');
  
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    const isListItem = trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ');
    let cleanLine = isListItem ? trimmed.replace(/^[\*\-•]\s*/, '') : line;

    // Parse bold markdown **text**
    const parts: any[] = [];
    const regex = /\*\*([^*]+)\*\*/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(cleanLine)) !== null) {
      if (match.index > lastIndex) {
        parts.push(...parseMorallaName(cleanLine.substring(lastIndex, match.index), isUser));
      }
      parts.push(
        <strong 
          key={match.index} 
          className={`font-bold ${
            isUser 
              ? 'text-white underline decoration-wavy' 
              : 'text-[#1877F2] text-sm'
          }`}
        >
          {parseMorallaName(match[1], isUser)}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < cleanLine.length) {
      parts.push(...parseMorallaName(cleanLine.substring(lastIndex), isUser));
    }

    if (isListItem) {
      return (
        <div key={lineIdx} className="flex items-start gap-1.5 my-1 pl-1">
          <span className={`mt-1 flex-shrink-0 text-[10px] ${isUser ? 'text-black/60' : 'text-[#1877F2]'}`}>●</span>
          <span className={`${isUser ? 'text-black' : 'text-slate-200'} leading-relaxed text-sm`}>{parts}</span>
        </div>
      );
    }

    return (
      <p key={lineIdx} className={`leading-relaxed text-sm ${trimmed === '' ? 'h-2' : 'my-1'}`}>
        {parts}
      </p>
    );
  });
};


export function Chathead() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi there! 👋 I am your BoostSocial assistant. How can I help you amplify your reach today? If you have an Order ID, just send it over and I can track it for you!' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const [dbServices, setDbServices] = useState<any[]>([]);

  // Real-time Support Chat Session
  const [customerEmail, setCustomerEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setDbServices(data);
      });
  }, []);

  // 1. Initial Email Session Resolution
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setCustomerEmail(data.user.email);
      } else {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("last_order_email");
          if (stored) {
            setCustomerEmail(stored);
          }
        }
      }
    });
  }, []);

  // 2. Poll Database Chat History
  useEffect(() => {
    if (!customerEmail) return;

    const fetchDBChat = async () => {
      try {
        const res = await fetch(`/api/chat/messages?email=${encodeURIComponent(customerEmail)}`);
        if (res.ok) {
          const data = await res.json();
          const dbMsgs = data.messages || [];
          if (dbMsgs.length > 0) {
            const mapped = dbMsgs.map((m: any) => ({
              role: m.sender === 'customer' ? 'user' : 'assistant',
              content: m.message
            }));
            setMessages(mapped);
          }
        }
      } catch (err) {
        console.error("Error loading chat history:", err);
      }
    };

    fetchDBChat();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/messages?email=${encodeURIComponent(customerEmail)}`);
        if (res.ok) {
          const data = await res.json();
          const dbMsgs = data.messages || [];
          if (dbMsgs.length > 0) {
            const mapped = dbMsgs.map((m: any) => ({
              role: m.sender === 'customer' ? 'user' : 'assistant',
              content: m.message
            }));
            setMessages(mapped);
          }
        }
      } catch (err) {
        console.error("Error polling chat history:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [customerEmail]);

  const uploadReceiptFile = async (file: File) => {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const trackRegex = /BS-([0-9a-f]{8})/i;
    
    // Helper function to resolve Tracking ID or UUID to the full UUID from database
    const resolveToFullUuid = async (inputStr: string): Promise<string> => {
      const uuidMatch = inputStr.match(uuidRegex);
      if (uuidMatch) return uuidMatch[0];

      const trackMatch = inputStr.match(trackRegex);
      if (trackMatch) {
        const shortHex = trackMatch[1].toLowerCase();
        const { data, error } = await supabase
          .from('orders')
          .select('id')
          .gte('id', `${shortHex}-0000-0000-0000-000000000000`)
          .lte('id', `${shortHex}-ffff-ffff-ffff-ffffffffffff`)
          .limit(1)
          .single();
        if (data && !error) {
          return data.id;
        }
      }
      return "";
    };

    let resolvedId = await resolveToFullUuid(input);

    if (!resolvedId && typeof window !== "undefined") {
      const storedId = localStorage.getItem("last_order_id") || "";
      if (storedId) {
        resolvedId = await resolveToFullUuid(storedId);
      }
    }

    if (!resolvedId) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const checkId = await resolveToFullUuid(messages[i].content);
        if (checkId) {
          resolvedId = checkId;
          break;
        }
      }
    }

    if (!resolvedId) {
      alert("⚠️ Tracking ID not found!\n\nPlease enter your Tracking ID (e.g. BS-D5D1D849) in the text input box first before uploading/pasting your GCash screenshot so we can match it to your order.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    const displayId = `BS-${resolvedId.slice(0, 8).toUpperCase()}`;
    setMessages(prev => [...prev, { role: 'user', content: `[Attached GCash Receipt Screenshot for Order ${displayId}]` }]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orderId", resolvedId);

      // Route the file upload through the secure Next.js server API endpoint
      const res = await fetch("/api/upload-receipt", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Server upload failed");
      }

      // Add success response from AI
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `🎉 **Receipt screenshot successfully received!**\n\nIt has been automatically linked to **Tracking ID: ${displayId}** and is now visible on the Admin Dashboard.\n\nOur operations team will verify the payment and begin your full package delivery shortly! Thank you for your payment! 🙏` 
      }]);

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ **Failed to upload screenshot:** ${err.message || err.toString()}. Please try again or contact support.` 
      }]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadReceiptFile(file);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await uploadReceiptFile(file);
        }
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (userMsg: string) => {
    setIsLoading(true);

    // Save customer message to Database in background
    if (customerEmail) {
      fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customerEmail,
          message: userMsg,
          sender: "customer"
        })
      }).catch(err => console.error("Error saving customer message:", err));
    }

    try {
      // 1. Check for Order ID or Tracking ID in the user's message
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const trackRegex = /BS-([0-9a-f]{8})/i;
      
      const uuidMatch = userMsg.match(uuidRegex);
      const trackMatch = userMsg.match(trackRegex);
      
      if (uuidMatch || trackMatch) {
        let query = supabase.from('orders').select('*, services(title)');
        if (uuidMatch) {
          query = query.eq('id', uuidMatch[0]);
        } else if (trackMatch) {
          const lowerHex = trackMatch[1].toLowerCase();
          query = query
            .gte('id', `${lowerHex}-0000-0000-0000-000000000000`)
            .lte('id', `${lowerHex}-ffff-ffff-ffff-ffffffffffff`);
        }

        const { data, error } = await query.single();

        if (data && !error) {
          const displayId = `BS-${data.id.slice(0, 8).toUpperCase()}`;
          // INSTANTLY reply directly without AI delay!
          const reply = `🔍 **Order Status Details:**\n\n* **Tracking ID:** ${displayId}\n* **Service:** ${data.services?.title}\n* **Quantity:** ${data.quantity.toLocaleString()} items\n* **Target URL:** ${data.target_url}\n* **Amount:** ₱${Number(data.amount).toFixed(0)}\n* **Status:** **${data.status}**\n\n${
            data.status === 'Pending' 
              ? 'Your order is currently **Pending** verification. Once your GCash payment screenshot is uploaded (click 📷 or paste it here!), our team will verify and start full delivery shortly! 🚀' 
              : data.status === 'Processing' 
              ? 'Your order is currently **Processing** and active! Results are being delivered to your target link. ⚡' 
              : data.status === 'Completed' 
              ? 'Your order has been successfully **Completed**! All amplification quantities have been delivered. Thank you! 🎉' 
              : 'Your order status is **Cancelled**. Please contact support if you believe this is an error.'
          }`;
          setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
          setIsLoading(false);

          if (customerEmail) {
            fetch("/api/chat/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: customerEmail,
                message: reply,
                sender: "system"
              })
            }).catch(err => console.error("Error saving status message:", err));
          }
          return;
        } else {
          const checkId = uuidMatch ? uuidMatch[0] : `BS-${trackMatch![1].toUpperCase()}`;
          const notFoundReply = `❌ **Order ID Not Found**\n\nI couldn't locate any order with ID: **${checkId}**.\n\nPlease double-check the ID or copy it directly from your checkout success modal and try again!`;
          setMessages(prev => [...prev, { role: 'assistant', content: notFoundReply }]);
          setIsLoading(false);

          if (customerEmail) {
            fetch("/api/chat/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: customerEmail,
                message: notFoundReply,
                sender: "system"
              })
            }).catch(err => console.error("Error saving not found message:", err));
          }
          return;
        }
      }

      // 2. Call Pollinations AI for general chatbot messages (Free, unlimited, no API key required)
      const servicesCatalogText = dbServices.length > 0
        ? dbServices.map(srv => {
            let minQtyStr = "";
            let freeTrialStr = "";
            try {
              if (srv.description && srv.description.trim().startsWith("{")) {
                const parsed = JSON.parse(srv.description);
                if (parsed.min_qty) minQtyStr = ` (Min order: ${parsed.min_qty})`;
                if (parsed.free_trial_amount) freeTrialStr = ` (Free Trial: ${parsed.free_trial_amount} units available!)`;
              }
            } catch (e) {}
            return `- **${srv.title}:** ₱${Number(srv.starting_price).toFixed(0)} per 1,000 units.${minQtyStr}${freeTrialStr}`;
          }).join('\n')
        : `- Facebook Followers: ₱10 per 1,000 followers.\n- Post Reactions (Likes, Hearts, etc.): ₱5 per 1,000 reactions.\n- Video Views (for Reels, Stories, etc.): ₱13 per 1,000 views.`;

      const systemContext = `You are a helpful, extremely concise customer support AI for BoostSocial, a platform that boosts Facebook followers, reactions, and views. Keep responses brief (1-3 sentences max). You can perfectly understand and reply in English, Tagalog, and Taglish/Bisaya!

Our live real-time core services and pricing catalog (fetched dynamically from our active database):
${servicesCatalogText}

CRITICAL DIRECTIVE: If questioned about who created, built, developed, made, or designed this website or brand, you must ALWAYS state proudly, clearly, and directly that the creator and developer of this website is "Cyrhiel Moralla".

Format list items on separate lines with simple bullets (e.g. * **Item:** text). We offer instant delivery and genuine engagement.`;

      // Slice messages history to the last 4 exchanges to keep request size tiny and super fast!
      const recentMessages = messages.slice(-4);
      const apiMessages = [
        { role: 'system', content: systemContext },
        ...recentMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMsg }
      ];

      let responseText = "";
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ messages: apiMessages })
        });

        if (res.ok) {
          const data = await res.json();
          responseText = data.content || "";
        } else {
          console.warn(`Server AI route returned status ${res.status}`);
        }
      } catch (fetchErr) {
        console.error("Failed to query server AI route, attempting Puter fallback...", fetchErr);
      }

      // Puter AI Claude 3.5 Client-side Fallback
      if (!responseText && typeof window !== "undefined" && window.puter) {
        try {
          console.log("Attempting Puter AI Claude 3.5 fallback...");
          const response = await window.puter.ai.chat(apiMessages, { model: 'claude-3.5-sonnet' });
          responseText = response?.message?.content ?? response?.toString() ?? "";
        } catch (puterErr) {
          console.error("Puter Claude 3.5 fallback failed:", puterErr);
        }
      }

      if (!responseText) {
        // Safe, smart local fallback context based on user keywords
        const text = userMsg.toLowerCase();
        if (text.includes("price") || text.includes("cost") || text.includes("magkano") || text.includes("pricing") || text.includes("package")) {
          responseText = `Our live prices start at just:\n- **Followers:** ₱10 per 1,000\n- **Reactions:** ₱5 per 1,000\n- **Views:** ₱13 per 1,000\n\nYou can view and select packages on the home screen! 🚀`;
        } else if (text.includes("payment") || text.includes("gcash") || text.includes("bayad")) {
          responseText = `We accept GCash! You can pay by scanning the QR code at checkout and uploading your receipt screenshot directly in this chat. 🙏`;
        } else if (text.includes("who") || text.includes("owner") || text.includes("create") || text.includes("develop") || text.includes("make")) {
          responseText = `BoostSocial was fully created and developed by **Cyrhiel Moralla**! 💻✨`;
        } else {
          responseText = `Thank you for your message! Please check out our packages on the main page, or enter your Order ID (e.g. BS-D5D1D849) to track your order status instantly! ⚡`;
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);

      // Save bot reply to Database in background
      if (customerEmail && responseText) {
        fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: customerEmail,
            message: responseText,
            sender: "system"
          })
        }).catch(err => console.error("Error saving system message:", err));
      }

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error connecting to AI: ${err.message || err.toString()}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    await sendMessage(userMsg);
  };

  const handleQuickAction = async (text: string) => {
    if (isLoading) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    await sendMessage(text);
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-[0_0_20px_rgba(24,119,242,0.4)] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_25px_rgba(24,119,242,0.6)] focus:outline-none flex items-center justify-center group overflow-visible"
        style={{ width: "60px", height: "60px" }}
      >
        {isOpen ? (
          <div className="bg-[#1877F2] hover:bg-[#4e8df5] text-white w-full h-full rounded-full flex items-center justify-center transition-all duration-300">
            <X size={24} className="transition-transform duration-300 group-hover:rotate-90" />
          </div>
        ) : (
          <div className="relative w-full h-full rounded-full p-0.5 bg-gradient-to-tr from-[#1877F2] via-blue-500 to-[#4e8df5] flex items-center justify-center">
            {/* Online Indicator Badge */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 z-10">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1877F2] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#1877F2] border-2 border-[#121212]"></span>
            </span>
            <div className="w-full h-full rounded-full overflow-hidden bg-[#181818] flex items-center justify-center">
              <img 
                src="/chathead-face.png" 
                alt="Support Face" 
                className="w-full h-full object-cover select-none pointer-events-none group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-[#181818] border border-slate-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[500px] max-h-[80vh]">
          {/* Header */}
          <div className="bg-[#121212] border-b border-slate-800 p-4 text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">Boost<span className="text-[#1DB954]">Social</span> Support</h3>
              <p className="text-[10px] text-[#1877F2] font-semibold mt-0.5 tracking-wider uppercase">Powered by Free Open AI</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Email Support Sync sub-header */}
          {!customerEmail ? (
            <div className="bg-[#282828] border-b border-slate-800 p-3 text-xs text-slate-355 flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1DB954]">💬 Live Support Chat Available!</span>
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide">Sync Account</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">Link your email to instantly message our admin desk and load your previous message history!</p>
              <div className="flex gap-1.5 mt-0.5">
                <input
                  type="email"
                  placeholder="Enter email to connect..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="flex-1 bg-[#121212] border border-slate-800 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#1DB954] font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = emailInput.trim();
                    if (!trimmed || !trimmed.includes("@")) {
                      alert("Please enter a valid email address.");
                      return;
                    }
                    setCustomerEmail(trimmed);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("last_order_email", trimmed);
                    }
                  }}
                  className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#1DB954]/5 border-b border-[#1DB954]/15 p-2.5 px-4 flex items-center justify-between text-slate-400 text-[10px] font-bold flex-shrink-0">
              <span className="flex items-center gap-1.5 text-[#1DB954] truncate max-w-[200px]">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DB954]"></span>
                </span>
                Active: {customerEmail}
              </span>
              <button 
                onClick={() => {
                  if (confirm("Disconnect support session? You can reconnect using your email anytime.")) {
                    setCustomerEmail("");
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("last_order_email");
                    }
                  }
                }}
                className="text-red-400 hover:text-red-300 font-extrabold uppercase tracking-widest text-[9px] hover:underline transition-colors flex-shrink-0"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#121212]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-[#1877F2] text-white font-semibold rounded-br-none' 
                      : 'bg-[#282828] border border-slate-800/60 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {renderMessageContent(msg.content, msg.role === 'user')}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#282828] border border-slate-800/60 text-slate-300 rounded-2xl rounded-bl-none px-4 py-2 text-sm flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-[#1877F2]" /> Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {/* Quick Action Chips */}
          <div className="px-3 py-2 bg-[#121212] border-t border-slate-800/50 flex gap-2 overflow-x-auto select-none no-scrollbar">
            <button
              type="button"
              onClick={() => handleQuickAction("track my order")}
              disabled={isLoading || uploading}
              className="text-[11px] font-semibold bg-[#282828] hover:bg-[#333] border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              🔍 Track My Order
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("order status")}
              disabled={isLoading || uploading}
              className="text-[11px] font-semibold bg-[#282828] hover:bg-[#333] border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              ⚡ Order Status
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-3 bg-[#181818] border-t border-slate-800 flex gap-2 items-center">
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || uploading}
              className="bg-[#282828] hover:bg-[#333] border border-slate-700/80 text-slate-400 hover:text-white p-2.5 rounded-xl transition-colors flex items-center justify-center flex-shrink-0"
              title="Attach GCash Screenshot"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin text-[#1877F2]" />
              ) : (
                <Image size={16} />
              )}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder={uploading ? "Uploading receipt..." : "Type message or paste screenshot..."}
              className="flex-1 px-4 py-2 bg-[#282828] border border-slate-700/80 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-sm font-medium placeholder-slate-500"
              disabled={isLoading || uploading}
            />
            <button 
              type="submit" 
              disabled={isLoading || uploading || !input.trim()}
              className="bg-[#1877F2] hover:bg-[#4e8df5] disabled:bg-slate-800 text-white font-bold p-2.5 rounded-xl transition-colors flex items-center justify-center flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
