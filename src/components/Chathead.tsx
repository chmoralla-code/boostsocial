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

const renderMessageContent = (content: string, isUser: boolean) => {
  const lines = content.split('\n');
  
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    const isListItem = trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ');
    let cleanLine = isListItem ? trimmed.replace(/^[\*\-•]\s*/, '') : line;

    // Parse bold markdown **text**
    const parts = [];
    const regex = /\*\*([^*]+)\*\*/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(cleanLine)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleanLine.substring(lastIndex, match.index));
      }
      parts.push(
        <strong 
          key={match.index} 
          className={`font-semibold ${
            isUser 
              ? 'text-white underline decoration-wavy' 
              : 'text-slate-900 bg-slate-100/90 px-1 py-0.5 rounded border border-slate-200/60 text-xs shadow-sm font-bold'
          }`}
        >
          {match[1]}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < cleanLine.length) {
      parts.push(cleanLine.substring(lastIndex));
    }

    if (isListItem) {
      return (
        <div key={lineIdx} className="flex items-start gap-1.5 my-1 pl-1">
          <span className={`mt-1 flex-shrink-0 text-[10px] ${isUser ? 'text-blue-200' : 'text-blue-600'}`}>●</span>
          <span className={`${isUser ? 'text-blue-50' : 'text-slate-700'} leading-relaxed text-sm`}>{parts}</span>
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
      
      let systemContext = `You are a helpful, extremely concise customer support AI for BoostSocial, a platform that boosts Facebook followers, reactions, and views. 

CRITICAL FORMATTING INSTRUCTIONS:
Always format your responses beautifully using spacing, lists, and bold text:
1. When providing order details, list each item on a separate line with a bullet point (e.g. * **Order ID:** 123-abc).
2. Bold key labels (like **Order ID:**, **Service:**, **Status:**, **Amount:**, **Target URL:**) using double asterisks.
3. Put important values (like the status "Cancelled", "Completed", etc.) in bold as well.
4. Keep the summary friendly, brief, and very clean. Use spacing between paragraphs.

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

      // 2. Call Pollinations AI (Free, unlimited, no API key required)
      const apiMessages = [
        { role: 'system', content: systemContext },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMsg }
      ];

      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const responseText = await res.text();
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error connecting to AI: ${err.message || err.toString()}` }]);
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
              <p className="text-xs text-blue-100">Powered by Free Open AI</p>
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
                  {renderMessageContent(msg.content, msg.role === 'user')}
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
