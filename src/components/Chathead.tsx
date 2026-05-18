"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
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

export function Chathead() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi there! 👋 I am your BoostSocial assistant. How can I help you amplify your reach today? If you have an Order ID, just send it over and I can track it for you!' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      // 1. Check for Order ID (UUID format) in the user's message
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = userMsg.match(uuidRegex);
      
      let systemContext = `You are a helpful customer support AI for BoostSocial, a platform that boosts Facebook followers, reactions, and views. 
Keep your answers concise, friendly, and professional.

Our core services and pricing:
- Facebook Followers: $9.99 per 1,000 followers.
- Post Reactions (Likes, Hearts, etc.): $4.99 per 1,000 reactions.
- Video Views (for Reels, Stories, etc.): $12.99 per 1,000 views.

We offer instant delivery and genuine engagement.`;

      if (match) {
        const orderId = match[0];
        // Fetch order details from Supabase
        const { data, error } = await supabase
          .from('orders')
          .select('*, services(title)')
          .eq('id', orderId)
          .single();

        if (data && !error) {
          systemContext += `\n\nThe user is asking about an order. Here is the order info:
Order ID: ${data.id}
Service: ${data.services?.title}
Status: ${data.status}
Quantity: ${data.quantity}
Target URL: ${data.target_url}
Amount: $${data.amount}

Inform the user about their order status based on this information. If the status is 'Pending', tell them it will be processed shortly.`;
        } else {
          systemContext += `\n\nThe user asked about Order ID ${orderId}, but no such order was found in the database. Politely tell them you couldn't find an order with that ID and suggest they double-check the ID or contact support.`;
        }
      }

      // 2. Call Puter AI with Claude 3.5 Sonnet
      if (!window.puter) {
        throw new Error("Puter is not loaded yet.");
      }

      const historyString = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      const prompt = `${systemContext}\n\nChat History:\n${historyString}\n\nUser: ${userMsg}\n\nAssistant:`;

      // Using Puter's default model (most reliable for free tier)
      const response = await window.puter.ai.chat(prompt);

      setMessages(prev => [...prev, { role: 'assistant', content: response.toString() }]);

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am having trouble connecting to my AI brain right now. Please try again in a moment.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-105"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden h-[500px] max-h-[80vh]">
          {/* Header */}
          <div className="bg-blue-600 p-4 text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold">BoostSocial Support</h3>
              <p className="text-xs text-blue-100">Powered by Puter AI (Free Tier)</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <X size={20} />
            </button>
          </div>


          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 text-slate-800 rounded-2xl rounded-bl-none px-4 py-2 text-sm flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-blue-600" /> Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded-xl transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
