"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
import NextImage from "next/image";
import { 
  X, 
  Send, 
  Loader2, 
  Image as ImageIcon, 
  ShoppingCart, 
  Ban, 
  CheckCircle2, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Search, 
  ExternalLink,
  UploadCloud
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { parseDescription } from "@/utils/serviceHelpers";
import { compressImageWithStats, formatBytes, type CompressResult } from "@/utils/imageCompressor";
import { useCustomerMessagesRealtime } from "@/hooks/useCustomerMessagesRealtime";
import type { CustomerMessageRow } from "@/utils/realtimeChat";

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string | number;
  offers?: ChatOffer[];
  offerCatalog?: OfferCatalogPage;
}

type OfferCatalogPage = {
  mode: "all" | "recommendation";
  query: string;
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  nextPage: number | null;
};

interface ChatOffer {
  id: string;
  actionKey: string;
  platform: string;
  serviceId: string;
  smmServiceId: string;
  name: string;
  category: string;
  quantity: number;
  min: number;
  max: number;
  pricePerThousand: number;
  regularTotal: number;
  total: number;
  vipDiscountPercent: number;
  catalogSnapshot: {
    id: string;
    name: string;
    startingPrice: number;
    min: number;
    max: number;
  };
}

type OfferActionStatus =
  | "idle"
  | "awaiting_target"
  | "processing"
  | "awaiting_receipt"
  | "purchased"
  | "cancelled";

type PendingReceiptOrder = {
  orderId: string;
  trackingId: string;
  amount: number;
};

interface DbService {
  id: string;
  title: string;
  description?: string | null;
  starting_price: number | string;
}

interface ChatDbMessage {
  id: string;
  sender: "customer" | "admin" | "system";
  message: string;
  is_read?: boolean;
  created_at?: string;
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function isOfferCatalogRequest(text: string) {
  const normalized = text.toLowerCase();
  const explicitlyAsksForAll =
    /\b(all|every)\b/.test(normalized) &&
    /\b(smm|social(?:\s+media)?|offers?|services?|platforms?)\b/.test(normalized);

  return (
    /\b(cheap|cheapest|lowest|budget|affordable|barato|mura)\b/.test(normalized) ||
    explicitlyAsksForAll
  );
}

function isValidTargetUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function formatPhp(value: number) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const MINIMUM_ORDER_TOTAL = 5;

function getOfferMinimumQuantity(offer: ChatOffer) {
  return Math.max(Math.ceil(Number(offer.min) || 1), 1);
}

function getOfferMaximumQuantity(offer: ChatOffer) {
  const maximum = Math.floor(Number(offer.max) || 0);
  return maximum > 0 ? Math.max(maximum, getOfferMinimumQuantity(offer)) : null;
}

function parseOfferQuantity(offer: ChatOffer, value: string) {
  if (!/^\d+$/.test(value.trim())) return null;

  const quantity = Number(value);
  const minimum = getOfferMinimumQuantity(offer);
  const maximum = getOfferMaximumQuantity(offer);

  if (!Number.isSafeInteger(quantity) || quantity < minimum || (maximum !== null && quantity > maximum)) {
    return null;
  }

  return quantity;
}

function estimateOfferTotals(offer: ChatOffer, quantity: number) {
  const snapshotUnitPrice = Number(offer.catalogSnapshot.startingPrice);
  const unitPrice = Number.isFinite(snapshotUnitPrice) && snapshotUnitPrice > 0
    ? snapshotUnitPrice
    : Number(offer.pricePerThousand) / 1000;
  const regularTotal = Number(Math.max(quantity * unitPrice, MINIMUM_ORDER_TOTAL).toFixed(2));
  const discountMultiplier = offer.regularTotal > 0 && offer.total > 0
    ? Math.min(Math.max(offer.total / offer.regularTotal, 0), 1)
    : Math.min(Math.max(1 - offer.vipDiscountPercent / 100, 0), 1);

  return {
    regularTotal,
    total: Number((regularTotal * discountMultiplier).toFixed(2)),
  };
}

type ChatOffersApiResponse = {
  error?: string;
  message?: string;
  offers?: Array<Omit<ChatOffer, "actionKey">>;
  catalog?: OfferCatalogPage;
};

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
    const cleanLine = isListItem ? trimmed.replace(/^[\*\-•]\s*/, '') : line;

    // Parse bold markdown **text**
    const parts: ReactNode[] = [];
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
              : 'text-[#1877F2]'
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
          <span className={`mt-1 flex-shrink-0 text-[10px] ${isUser ? 'text-white/70' : 'text-[#1877F2]'}`}>●</span>
          <span className={`${isUser ? 'text-white' : 'text-slate-200'} leading-relaxed text-sm`}>{parts}</span>
        </div>
      );
    }

    return (
      <p key={lineIdx} className={`leading-relaxed text-sm ${isUser ? 'text-white' : ''} ${trimmed === '' ? 'h-2' : 'my-1'}`}>
        {parts}
      </p>
    );
  });
};

export function Chathead() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const initialWelcomeMsg: Message = { 
    role: 'assistant', 
    content: '👋 Hi! Welcome to **PinoyBoosting** support.\n\nTell me what you need (Facebook followers, reactions, views, TikTok, PisoWiFi, or send a **Tracking ID** like `BS-D5D1D849` to check your live order).' 
  };

  const [messages, setMessages] = useState<Message[]>([initialWelcomeMsg]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);
  const [adminNotice, setAdminNotice] = useState("");
  const [pendingCheckoutOffer, setPendingCheckoutOffer] = useState<ChatOffer | null>(null);
  const [pendingReceiptOrder, setPendingReceiptOrder] = useState<PendingReceiptOrder | null>(null);
  const [offerActionStatus, setOfferActionStatus] = useState<Record<string, OfferActionStatus>>({});
  const [offerQuantityInputs, setOfferQuantityInputs] = useState<Record<string, string>>({});
  const [loadingOfferPages, setLoadingOfferPages] = useState<Record<string, boolean>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const [dbServices, setDbServices] = useState<DbService[]>([]);

  // Real-time Support Chat Session
  const [customerEmail, setCustomerEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");

  const playChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.31);
    } catch {}
  }, [soundEnabled]);

  const markAdminRepliesRead = useCallback((emailToMark: string) => {
    fetch("/api/chat/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailToMark, reader: "customer" })
    }).catch((err) => console.error("Error marking admin replies as read:", err));
  }, []);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const localEchoRef = useRef<Array<{ content: string; role: Message["role"]; ts: number }>>([]);
  const isOpenRef = useRef(isOpen);
  const customerEmailRef = useRef(customerEmail);
  const hasLoadedHistoryRef = useRef(false);
  const [compressState, setCompressState] = useState<CompressResult | null>(null);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { customerEmailRef.current = customerEmail; }, [customerEmail]);

  const pushLocalMessage = useCallback((msg: Message) => {
    const stamped: Message = {
      ...msg,
      createdAt: msg.createdAt ?? Date.now(),
    };
    localEchoRef.current.push({ content: stamped.content, role: stamped.role, ts: Date.now() });
    if (localEchoRef.current.length > 20) localEchoRef.current = localEchoRef.current.slice(-20);
    setMessages((prev) => [...prev, stamped]);
    if (msg.role === "assistant") {
      playChime();
    }
  }, [playChime]);

  const appendOfferPage = useCallback((offerData: ChatOffersApiResponse, fallbackQuery: string) => {
    if (!offerData.offers?.length) return false;

    const offers = offerData.offers.map((offer) => ({
      ...offer,
      actionKey: crypto.randomUUID(),
    }));
    setOfferQuantityInputs((current) => ({
      ...current,
      ...Object.fromEntries(offers.map((offer) => [offer.actionKey, String(offer.quantity)])),
    }));
    pushLocalMessage({
      id: `catalog-${crypto.randomUUID()}`,
      role: "assistant",
      content: offerData.message || "Here are the matching live SMM services.",
      offers,
      offerCatalog: offerData.catalog
        ? {
            ...offerData.catalog,
            query: offerData.catalog.query || fallbackQuery,
          }
        : undefined,
    });
    return true;
  }, [pushLocalMessage]);

  const handleLoadMoreOffers = useCallback(async (messageId: string, catalog: OfferCatalogPage) => {
    if (!catalog.hasMore || !catalog.nextPage || loadingOfferPages[messageId]) return;

    setLoadingOfferPages((current) => ({ ...current, [messageId]: true }));
    try {
      const response = await fetch("/api/chat/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: catalog.query, page: catalog.nextPage }),
      });
      const data = await response.json() as ChatOffersApiResponse;
      if (!response.ok) {
        throw new Error(data.error || "Could not load more SMM services.");
      }

      setMessages((current) => current.map((message) =>
        message.id === messageId && message.offerCatalog
          ? {
              ...message,
              offerCatalog: undefined,
            }
          : message
      ));

      if (!appendOfferPage(data, catalog.query)) {
        pushLocalMessage({
          role: "assistant",
          content: `All **${catalog.totalCount.toLocaleString()}** matching SMM services have been shown.`,
        });
      }
    } catch (error) {
      pushLocalMessage({
        role: "assistant",
        content: `I couldn’t load the next SMM service page: ${getErrorMessage(error)} Please tap **Show more** to retry.`,
      });
    } finally {
      setLoadingOfferPages((current) => {
        const next = { ...current };
        delete next[messageId];
        return next;
      });
    }
  }, [appendOfferPage, loadingOfferPages, pushLocalMessage]);

  const applyRemoteInsert = useCallback(
    (row: CustomerMessageRow, options?: { fromHistory?: boolean }) => {
      if (seenIdsRef.current.has(row.id)) return;
      const role: Message["role"] = row.sender === "customer" ? "user" : "assistant";
      const now = Date.now();
      if (!options?.fromHistory) {
        const echo = localEchoRef.current.find(
          (e) => e.role === role && e.content === row.message && now - e.ts < 8000
        );
        if (echo) {
          seenIdsRef.current.add(row.id);
          setMessages((prev) => {
            const idx = [...prev].reverse().findIndex(
              (m) => !m.id && m.role === role && m.content === row.message
            );
            if (idx < 0) return prev;
            const realIdx = prev.length - 1 - idx;
            const next = [...prev];
            next[realIdx] = {
              ...next[realIdx],
              id: row.id,
              createdAt: row.created_at || next[realIdx].createdAt,
            };
            return next;
          });
          return;
        }
      }
      seenIdsRef.current.add(row.id);
      setMessages((prev) => [
        ...prev,
        {
          id: row.id,
          role,
          content: row.message,
          createdAt: row.created_at || Date.now(),
        },
      ]);

      if (row.sender === "customer") return;
      playChime();

      if (isOpenRef.current) {
        if (customerEmailRef.current) markAdminRepliesRead(customerEmailRef.current);
        setUnreadAdminCount(0);
        setAdminNotice("");
      } else {
        setUnreadAdminCount((c) => c + 1);
        setAdminNotice(row.message);
      }
    },
    [markAdminRepliesRead, playChime]
  );

  useCustomerMessagesRealtime({
    email: customerEmail || undefined,
    scope: "customer",
    enabled: Boolean(customerEmail),
    onInsert: (row) => applyRemoteInsert(row),
  });

  const openSupportChat = useCallback((prefillMessage?: string) => {
    setIsOpen(true);
    setUnreadAdminCount(0);
    setAdminNotice("");
    if (prefillMessage) {
      setInput(prefillMessage);
    }
    if (customerEmail) {
      markAdminRepliesRead(customerEmail);
    }
  }, [customerEmail, markAdminRepliesRead]);

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setDbServices(data as DbService[]);
      });
  }, [supabase]);

  // Initial Email Session Resolution
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setCustomerEmail(data.user.email.trim().toLowerCase());
      } else {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("last_order_email");
          if (stored) {
            setCustomerEmail(stored.trim().toLowerCase());
          }
        }
      }
    });
  }, [supabase]);

  // Load chat history once on email connect
  useEffect(() => {
    if (!customerEmail) return;
    hasLoadedHistoryRef.current = false;
    seenIdsRef.current = new Set();

    const syncUnreadState = (dbMsgs: ChatDbMessage[]) => {
      const unreadAdminMessages = dbMsgs.filter((m) => m.sender !== "customer" && !m.is_read);
      if (isOpen) {
        if (unreadAdminMessages.length > 0) {
          markAdminRepliesRead(customerEmail);
        }
        setUnreadAdminCount(0);
        setAdminNotice("");
      } else if (unreadAdminMessages.length > 0) {
        const latestAdminMessage = unreadAdminMessages[unreadAdminMessages.length - 1];
        setUnreadAdminCount(unreadAdminMessages.length);
        setAdminNotice(latestAdminMessage?.message || "Admin sent you a message.");
      } else {
        setUnreadAdminCount(0);
        setAdminNotice("");
      }
    };

    const fetchDBChat = async () => {
      try {
        const res = await fetch(`/api/chat/messages?email=${encodeURIComponent(customerEmail)}`);
        if (!res.ok) return;
        const data = await res.json();
        const dbMsgs = (data.messages || []) as ChatDbMessage[];

        if (!hasLoadedHistoryRef.current) {
          hasLoadedHistoryRef.current = true;
          seenIdsRef.current = new Set(dbMsgs.map((m) => m.id));
          const mapped: Message[] = dbMsgs.map((m) => ({
            id: m.id,
            role: m.sender === "customer" ? "user" : "assistant",
            content: m.message,
            createdAt: m.created_at,
          }));
          setMessages((prev) => {
            const localOnly = prev.filter((local) => {
              if (local.offers?.length) {
                return !mapped.some((m) => m.content === local.content);
              }
              if (local.id) {
                return !mapped.some((m) => m.id === local.id);
              }
              return !mapped.some((m) => m.role === local.role && m.content === local.content);
            });
            if (mapped.length === 0) {
              return localOnly.length > 0 ? localOnly : prev;
            }
            return [...mapped, ...localOnly];
          });
        } else {
          for (const m of dbMsgs) {
            if (!seenIdsRef.current.has(m.id)) {
              applyRemoteInsert({
                id: m.id,
                customer_email: customerEmail,
                sender: m.sender,
                message: m.message,
                is_read: Boolean(m.is_read),
                created_at: "",
              });
            }
          }
        }

        syncUnreadState(dbMsgs);
      } catch (err) {
        console.error("Error loading chat history:", err);
      }
    };

    fetchDBChat();
    const interval = setInterval(fetchDBChat, 30000);

    return () => clearInterval(interval);
  }, [customerEmail, isOpen, markAdminRepliesRead, applyRemoteInsert]);

  useEffect(() => {
    const handleOpenSupportChat = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      openSupportChat(detail?.message);
    };

    window.addEventListener("open-support-chat", handleOpenSupportChat);
    return () => {
      window.removeEventListener("open-support-chat", handleOpenSupportChat);
    };
  }, [openSupportChat]);

  const uploadReceiptFile = async (file: File) => {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const trackRegex = /BS-([0-9a-f]{8})/i;
    
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

    let resolvedId = pendingReceiptOrder?.orderId || await resolveToFullUuid(input);

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
      alert("⚠️ Tracking ID not found!\n\nPlease enter your Tracking ID (e.g. BS-D5D1D849) in the text input box first before uploading/pasting your payment proof so we can match it to your order.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    const displayId = `BS-${resolvedId.slice(0, 8).toUpperCase()}`;
    pushLocalMessage({ role: 'user', content: `[Attached Payment Proof for Order ${displayId}]` });

    try {
      setCompressState({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        savedBytes: 0,
        ratio: 0,
        width: 0,
        height: 0,
        durationMs: 0,
      });
      const result = await compressImageWithStats(file, {
        onProgress: (p) => {
          setCompressState((prev) =>
            prev ? { ...prev, ratio: p.progress } : prev
          );
        },
      });
      setCompressState(result);
      setTimeout(() => setCompressState(null), 2500);

      const formData = new FormData();
      formData.append("file", result.file);
      formData.append("orderId", resolvedId);

      const res = await fetch("/api/upload-receipt", {
        method: "POST",
        body: formData
      });

      const uploadData = await res.json() as {
        error?: string;
        receiptAnalysis?: {
          decision?: "approved" | "rejected_fake" | "rejected_duplicate" | "manual_review";
          extractedAmount?: number | null;
          receiverName?: string | null;
          reason?: string;
        };
      };
      if (!res.ok) {
        throw new Error(uploadData.error || "Server upload failed");
      }

      const savedLabel = result.savedBytes > 0
        ? ` (${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)})`
        : "";
      const analysis = uploadData.receiptAnalysis;
      const receiptAmount = analysis?.extractedAmount !== null && analysis?.extractedAmount !== undefined
        ? formatPhp(analysis.extractedAmount)
        : "unreadable amount";
      const aiReviewNote = analysis?.decision === "approved"
        ? `\n\n✅ **Payment verified:** ${receiptAmount}, destination **${analysis.receiverName || "Henry S."}**, and a unique payment reference matched. Your order is now processing!`
        : analysis?.decision === "rejected_fake"
          ? `\n\n❌ **Receipt rejected:** signs of an altered receipt were detected. ${analysis.reason || ""}`.trim()
          : analysis?.decision === "rejected_duplicate"
            ? `\n\n❌ **Receipt rejected:** that payment reference was already used on another active transaction.`
            : `\n\n🔎 **Sent for manual review:** ${analysis?.reason || "Admin has been notified and will verify within 15 minutes."}`;

      pushLocalMessage({
        role: 'assistant',
        content: `🎉 **Receipt screenshot successfully received!**\n\nLinked to **Tracking ID: ${displayId}**.${aiReviewNote}${savedLabel ? `\n\n📦 Image optimized${savedLabel}.` : ""}`
      });
      setPendingReceiptOrder(null);

    } catch (err: unknown) {
      console.error(err);
      pushLocalMessage({
        role: 'assistant',
        content: `❌ **Failed to upload screenshot:** ${getErrorMessage(err)}. Please try again or contact support.`
      });
    } finally {
      setUploading(false);
      setCompressState(null);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        await uploadReceiptFile(file);
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateOfferStatus = (offer: ChatOffer, status: OfferActionStatus) => {
    setOfferActionStatus((current) => ({ ...current, [offer.actionKey]: status }));
  };

  const getSelectedOffer = (offer: ChatOffer) => {
    const rawQuantity = offerQuantityInputs[offer.actionKey] ?? String(offer.quantity);
    const quantity = parseOfferQuantity(offer, rawQuantity);
    if (quantity === null) return null;

    return {
      ...offer,
      quantity,
      ...estimateOfferTotals(offer, quantity),
    };
  };

  const handleCancelOffer = (offer: ChatOffer) => {
    updateOfferStatus(offer, "cancelled");
    if (pendingCheckoutOffer?.actionKey === offer.actionKey) {
      setPendingCheckoutOffer(null);
    }
    pushLocalMessage({
      role: "assistant",
      content: `No problem — I cancelled **${offer.name}**. Your wallet was not charged.`,
    });
  };

  const handleBuyOffer = async (offer: ChatOffer) => {
    if (isLoading || uploading || pendingCheckoutOffer) return;
    updateOfferStatus(offer, "processing");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id || !user.email) {
      updateOfferStatus(offer, "idle");
      pushLocalMessage({
        role: "assistant",
        content: "🔐 **Please sign in first.** Direct wallet purchases and payment-proof uploads must be linked to your PinoyBoosting account. After signing in, return here and tap Buy again.",
      });
      return;
    }

    setPendingCheckoutOffer(offer);
    setPendingReceiptOrder(null);
    updateOfferStatus(offer, "awaiting_target");
    pushLocalMessage({
      role: "assistant",
      content: `Send the public profile, page, post, or video link for **${offer.name}**.\n\n* **Quantity:** ${offer.quantity.toLocaleString()}\n* **Estimated total:** ${formatPhp(offer.total)}\n\nI’ll re-check the live price, then pay from your wallet automatically.`,
    });
  };

  const completeOfferCheckout = async (offer: ChatOffer, targetUrl: string) => {
    updateOfferStatus(offer, "processing");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id || !user.email) {
      updateOfferStatus(offer, "idle");
      setPendingCheckoutOffer(null);
      throw new Error("Please sign in before buying from the chatbot.");
    }

    const checkoutPayload = {
      userId: user.id,
      serviceId: offer.serviceId,
      email: user.email,
      url: targetUrl,
      quantity: offer.quantity,
      smmServiceId: offer.smmServiceId,
      catalogSnapshot: offer.catalogSnapshot,
    };

    const walletRes = await fetch("/api/checkout-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkoutPayload),
    });
    const walletData = await walletRes.json() as {
      error?: string;
      code?: string;
      orderId?: string;
      newBalance?: number;
      amount?: number;
      quantity?: number;
      serviceTitle?: string;
      requiredAmount?: number;
    };

    if (walletRes.ok && walletData.orderId) {
      const trackingId = `BS-${walletData.orderId.slice(0, 8).toUpperCase()}`;
      updateOfferStatus(offer, "purchased");
      setPendingCheckoutOffer(null);
      if (typeof window !== "undefined") {
        localStorage.setItem("last_order_id", walletData.orderId);
        localStorage.setItem("last_order_email", user.email);
        window.dispatchEvent(new CustomEvent("pinoyboosting-wallet-updated", {
          detail: { balance: walletData.newBalance },
        }));
      }
      pushLocalMessage({
        role: "assistant",
        content: `✅ **Purchase complete!**\n\n* **Tracking ID:** ${trackingId}\n* **Service:** ${walletData.serviceTitle || offer.name}\n* **Quantity:** ${Number(walletData.quantity || offer.quantity).toLocaleString()}\n* **Paid from wallet:** ${formatPhp(Number(walletData.amount ?? offer.total))}\n* **New wallet balance:** ${formatPhp(Number(walletData.newBalance || 0))}\n\nYour order is processing now.`,
      });
      return;
    }

    if (walletRes.status !== 402 && walletData.code !== "INSUFFICIENT_BALANCE") {
      updateOfferStatus(offer, "awaiting_target");
      throw new Error(walletData.error || "Wallet checkout failed.");
    }

    const orderId = crypto.randomUUID();
    const createRes = await fetch("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        serviceId: offer.serviceId,
        email: user.email,
        targetUrl,
        paymentMethod: "GCash",
        quantity: offer.quantity,
        smmServiceId: offer.smmServiceId,
        catalogSnapshot: offer.catalogSnapshot,
      }),
    });
    const createData = await createRes.json() as {
      error?: string;
      orderId?: string;
      amount?: number;
      quantity?: number;
      serviceTitle?: string;
    };
    if (!createRes.ok || !createData.orderId) {
      updateOfferStatus(offer, "awaiting_target");
      throw new Error(createData.error || "Could not create the GCash order.");
    }

    const trackingId = `BS-${createData.orderId.slice(0, 8).toUpperCase()}`;
    const amount = Number(createData.amount ?? walletData.requiredAmount ?? offer.total);
    setPendingCheckoutOffer(null);
    setPendingReceiptOrder({ orderId: createData.orderId, trackingId, amount });
    updateOfferStatus(offer, "awaiting_receipt");
    if (typeof window !== "undefined") {
      localStorage.setItem("last_order_id", createData.orderId);
      localStorage.setItem("last_order_email", user.email);
    }
    pushLocalMessage({
      role: "assistant",
      content: `💳 **Wallet balance is not enough, so it was not charged.**\n\nI created **${trackingId}** for payment.\n\n* **Pay exactly:** ${formatPhp(amount)}\n* **GCash destination:** 09505339963\n* **Receiver:** Henry S.\n* **BPI Option:** #4059901356\n\nPay via GCash or Bank Transfer, then click the image icon or drag-and-drop your receipt screenshot here to verify!`,
    });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    if (confirm("Clear support chat history on your screen?")) {
      setMessages([initialWelcomeMsg]);
      setPendingCheckoutOffer(null);
      setPendingReceiptOrder(null);
    }
  };

  const sendMessage = async (userMsg: string) => {
    setIsLoading(true);

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
      if (pendingCheckoutOffer) {
        if (/^(cancel|cancel order|never mind|nevermind)$/i.test(userMsg.trim())) {
          handleCancelOffer(pendingCheckoutOffer);
          setIsLoading(false);
          return;
        }

        if (!isValidTargetUrl(userMsg)) {
          pushLocalMessage({
            role: "assistant",
            content: "Please send a complete public link beginning with **https://** so I can attach the order to the correct target. You can also type **cancel**.",
          });
          setIsLoading(false);
          return;
        }

        try {
          await completeOfferCheckout(pendingCheckoutOffer, userMsg);
        } catch (checkoutError) {
          pushLocalMessage({
            role: "assistant",
            content: `❌ **Checkout could not finish:** ${getErrorMessage(checkoutError)}`,
          });
        }
        setIsLoading(false);
        return;
      }

      if (isOfferCatalogRequest(userMsg)) {
        try {
          const offerRes = await fetch("/api/chat/offers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: userMsg, page: 1 }),
          });
          const offerData = await offerRes.json() as ChatOffersApiResponse;

          if (offerRes.ok && appendOfferPage(offerData, userMsg)) {
            setIsLoading(false);
            return;
          }
          throw new Error(offerData.error || offerData.message || "No matching SMM services are available.");
        } catch (offerError) {
          console.error("SMM offer catalog lookup failed:", offerError);
          pushLocalMessage({
            role: "assistant",
            content: `I couldn’t load the live SMM catalog right now: ${getErrorMessage(offerError)} Please try again in a moment.`,
          });
          setIsLoading(false);
          return;
        }
      }

      // Check for Order ID or Tracking ID in the user's message
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
          const reply = `🔍 **Order Status Details:**\n\n* **Tracking ID:** ${displayId}\n* **Service:** ${data.services?.title || "Boost Service"}\n* **Quantity:** ${data.quantity.toLocaleString()} units\n* **Target Link:** ${data.target_url}\n* **Amount:** ₱${Number(data.amount).toFixed(2)} PHP\n* **Status:** **${data.status}**\n\n${
            data.status === 'Pending' 
              ? 'Your order is currently **Pending** verification. Upload your GCash/Bank receipt screenshot here (click 📷 or drag-and-drop!) to confirm delivery! 🚀' 
              : data.status === 'Processing' 
              ? 'Your order is currently **Processing** and active! Delivery is ongoing. ⚡' 
              : data.status === 'Completed' 
              ? 'Your order has been successfully **Completed**! All units delivered. Thank you! 🎉' 
              : data.status === 'Rejected'
              ? 'Your order status is **Rejected**. Please contact support if you believe this is an error.'
              : 'Your order status is **Cancelled**. Funds have been credited to your wallet balance.'
          }`;
          pushLocalMessage({ role: 'assistant', content: reply });
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
          const notFoundReply = `❌ **Order ID Not Found**\n\nI couldn't locate any order with ID: **${checkId}**.\n\nPlease double-check the ID or copy it directly from your checkout success screen and try again!`;
          pushLocalMessage({ role: 'assistant', content: notFoundReply });
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

      // Query server AI route
      const recentMessages = messages.slice(-5);
      const apiMessages = [
        ...recentMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMsg }
      ];

      let responseText = "";
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages })
        });

        if (res.ok) {
          const data = await res.json();
          responseText = data.content || "";
        }
      } catch (fetchErr) {
        console.error("Failed to query server AI route:", fetchErr);
      }

      if (!responseText) {
        const text = userMsg.toLowerCase();
        if (text.includes("price") || text.includes("cost") || text.includes("magkano") || text.includes("pricing") || text.includes("package")) {
          responseText = `💰 Prices vary by platform:\n* **Facebook Followers:** ₱10 per 1,000\n* **FB Post Reactions:** ₱5 per 1,000\n* **Video Views:** ₱13 per 1,000\n* **TikTok Followers:** ₱45 per 1,000\n\nOpen SERVICES to choose a package!`;
        } else if (text.includes("payment") || text.includes("gcash") || text.includes("bayad") || text.includes("bpi")) {
          responseText = `💳 We accept **GCash** (09505339963 • Henry S.) and **BPI Bank Transfer** (#4059901356). Upload your screenshot here after paying for instant approval.`;
        } else if (text.includes("who") || text.includes("owner") || text.includes("create") || text.includes("developer") || text.includes("cyrhiel")) {
          responseText = `PinoyBoosting was created and developed by **Cyrhiel Moralla**. Check his Facebook profile: [Cyrhiel Moralla](https://www.facebook.com/profile.php?id=61584774638218).`;
        } else {
          responseText = `Got you! Tell me what you'd like to boost (Facebook, TikTok, Instagram, YouTube) or paste a Tracking ID like **BS-D5D1D849** and I'll check it right away!`;
        }
      }

      pushLocalMessage({ role: 'assistant', content: responseText });

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

    } catch (err: unknown) {
      console.error(err);
      pushLocalMessage({ role: 'assistant', content: `Sorry, I had trouble connecting. Please send your Tracking ID or try again!` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    pushLocalMessage({ role: 'user', content: userMsg });
    await sendMessage(userMsg);
  };

  const handleQuickAction = async (text: string) => {
    if (isLoading) return;
    pushLocalMessage({ role: 'user', content: text });
    await sendMessage(text);
  };

  return (
    <>
      {/* Unread Message Pill Alert */}
      {!isOpen && unreadAdminCount > 0 && (
        <button
          type="button"
          onClick={() => openSupportChat()}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-3 z-50 max-w-[280px] rounded-2xl border border-red-500/30 bg-[#181818] p-3.5 text-left shadow-2xl shadow-red-500/20 transition-all hover:border-red-400 hover:scale-105 active:scale-95 sm:bottom-24 sm:right-6 animate-bounce"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
              Admin replied ({unreadAdminCount})
            </span>
          </div>
          <span className="block truncate text-xs font-bold text-white">
            {adminNotice || "Open chat to read message"}
          </span>
        </button>
      )}

      {/* Floating Chathead Button */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 sm:bottom-6 sm:right-6 z-50 flex items-center gap-3">
        {/* Subtle Greeting Bubble */}
        {!isOpen && unreadAdminCount === 0 && (
          <div 
            onClick={() => openSupportChat()}
            className="hidden md:flex items-center gap-2 bg-[#181818]/95 backdrop-blur-md border border-white/10 hover:border-[#1DB954]/50 py-2 px-3.5 rounded-2xl shadow-xl text-xs font-bold text-zinc-200 hover:text-white cursor-pointer transition-all duration-300 hover:scale-105 select-none animate-in fade-in slide-in-from-right-4"
          >
            <Sparkles size={14} className="text-[#1DB954]" />
            <span>Chat Support & Tracking</span>
          </div>
        )}

        <button 
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
            } else {
              openSupportChat();
            }
          }}
          className="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center rounded-full shadow-[0_0_25px_rgba(24,119,242,0.45)] transition-all duration-300 hover:scale-110 active:scale-95 group focus:outline-none"
          aria-label={isOpen ? "Close support chat" : "Open support chat"}
        >
          {isOpen ? (
            <div className="bg-[#1877F2] hover:bg-[#166fe5] text-white w-full h-full rounded-full flex items-center justify-center shadow-lg transition-transform duration-300">
              <X size={24} className="transition-transform duration-300 group-hover:rotate-90" />
            </div>
          ) : (
            <div className="relative w-full h-full rounded-full p-0.5 bg-gradient-to-tr from-[#1877F2] via-blue-500 to-[#1DB954] flex items-center justify-center">
              {/* Online Indicator Badge */}
              {unreadAdminCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 z-20 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#121212] bg-red-500 px-1 text-[10px] font-black text-white shadow-lg animate-pulse">
                  {unreadAdminCount > 9 ? "9+" : unreadAdminCount}
                </span>
              ) : (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 z-10">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#1DB954] border-2 border-[#121212]"></span>
                </span>
              )}
              <div className="w-full h-full rounded-full overflow-hidden bg-[#181818] flex items-center justify-center">
                <NextImage
                  src="/chathead-face.png" 
                  alt="Support Agent" 
                  width={60}
                  height={60}
                  className="w-full h-full object-cover select-none pointer-events-none group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Chat Window Modal */}
      {isOpen && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleDrop}
          className={`fixed z-50 bg-[#121212] border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isMaximized 
              ? "inset-2 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[720px] sm:h-[820px] sm:max-h-[92vh]" 
              : "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] left-3 right-3 h-[540px] max-h-[82vh] sm:left-auto sm:bottom-24 sm:right-6 sm:w-[410px] sm:h-[600px] sm:max-h-[85vh]"
          }`}
        >
          {/* Drag Overlay */}
          {isDraggingFile && (
            <div className="absolute inset-0 z-50 bg-[#1877F2]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white border-2 border-dashed border-white/80 animate-in fade-in duration-200">
              <UploadCloud size={48} className="animate-bounce mb-3" />
              <h4 className="text-lg font-black uppercase tracking-wider">Drop Payment Screenshot</h4>
              <p className="text-xs text-white/90 mt-1">Release file to automatically upload receipt and match with your order</p>
            </div>
          )}

          {/* Header */}
          <div className="bg-[#181818] border-b border-white/10 p-3.5 sm:p-4 text-white flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0">
                <NextImage 
                  src="/chathead-face.png" 
                  alt="Avatar" 
                  fill 
                  className="object-cover"
                />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
                    <span>PinoyBoosting</span>
                    <span className="text-[10px] bg-[#1DB954] text-black font-black px-1.5 py-0.2 rounded-md uppercase">AI</span>
                  </h3>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium tracking-wide truncate">
                  DeepSeek Core · Live Order Tracking
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 shrink-0 text-zinc-400">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-zinc-600" />}
              </button>

              {/* Clear Chat */}
              <button
                type="button"
                onClick={handleClearChat}
                className="p-2 hover:text-red-400 hover:bg-white/10 rounded-xl transition cursor-pointer"
                title="Clear chat"
              >
                <Trash2 size={16} />
              </button>

              {/* Maximize / Restore Toggle */}
              <button
                type="button"
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                title={isMaximized ? "Restore size" : "Maximize window"}
              >
                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              {/* Close Button */}
              <button 
                type="button"
                onClick={() => setIsOpen(false)} 
                className="p-2 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer ml-1"
                title="Close chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Email Support Sync Sub-header */}
          {!customerEmail ? (
            <div className="bg-[#181818]/60 border-b border-white/10 p-3 text-xs text-white flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1DB954] flex items-center gap-1.5">
                  <Sparkles size={13} /> Link Email for Order Sync
                </span>
                <span className="text-[9px] text-zinc-500 uppercase font-black">Session Sync</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-normal">
                Enter your email to load your previous order history and chat directly with admin support!
              </p>
              <div className="flex gap-1.5">
                <input
                  type="email"
                  placeholder="Enter email to connect..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/15 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#1DB954] font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = emailInput.trim().toLowerCase();
                    if (!trimmed || !trimmed.includes("@")) {
                      alert("Please enter a valid email address.");
                      return;
                    }
                    setCustomerEmail(trimmed);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("last_order_email", trimmed);
                    }
                  }}
                  className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-black px-3.5 py-1.5 rounded-xl text-[10px] uppercase tracking-wider transition active:scale-95 cursor-pointer"
                >
                  Connect
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#1DB954]/8 border-b border-[#1DB954]/20 p-2.5 px-4 flex items-center justify-between text-zinc-400 text-[10px] font-bold shrink-0">
              <span className="flex items-center gap-1.5 text-[#1DB954] truncate max-w-[240px]">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DB954]"></span>
                </span>
                Active: {customerEmail}
              </span>
              <button 
                onClick={() => {
                  if (confirm("Disconnect support session? You can reconnect anytime.")) {
                    setCustomerEmail("");
                    setUnreadAdminCount(0);
                    setAdminNotice("");
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("last_order_email");
                    }
                  }
                }}
                className="text-red-400 hover:text-red-300 font-black uppercase tracking-wider text-[9px] hover:underline transition cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/40">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const maxWidth = isMaximized 
                ? (msg.offers?.length ? "max-w-[95%]" : isUser ? "max-w-[70%]" : "max-w-[85%]")
                : (msg.offers?.length ? "max-w-[95%]" : isUser ? "max-w-[80%]" : "max-w-[88%]");

              const msgKey = msg.id || `msg-${i}`;

              return (
                <div
                  key={msgKey}
                  className={`flex w-full group ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={`relative ${maxWidth} ${isUser ? "ml-auto" : "mr-auto"}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm shadow-sm break-words ${
                        isUser
                          ? "bg-[#1877F2] text-white font-semibold rounded-br-none"
                          : "bg-[#1c1c1c] border border-white/10 text-zinc-100 rounded-bl-none"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className={`block text-[9px] font-black uppercase tracking-widest ${
                          isUser ? "text-white/80" : "text-[#1877F2]"
                        }`}>
                          {isUser ? "You" : "PinoyBoosting Support"}
                        </span>
                        
                        {/* Copy Message Button */}
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, msgKey)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white transition p-1 rounded-md hover:bg-white/10"
                            title="Copy text"
                          >
                            {copiedId === msgKey ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        )}
                      </div>

                      {renderMessageContent(msg.content, isUser)}

                      {/* Live SMM Catalog Offers */}
                      {msg.offers?.length ? (
                        <div className={`mt-3.5 space-y-2.5 ${isMaximized ? "grid grid-cols-1 sm:grid-cols-2 gap-3 space-y-0" : ""}`}>
                          {msg.offers.map((offer) => {
                            const status = offerActionStatus[offer.actionKey] || "idle";
                            const busy = status === "processing";
                            const terminal = status === "purchased" || status === "cancelled";
                            const quantityInput = offerQuantityInputs[offer.actionKey] ?? String(offer.quantity);
                            const selectedOffer = getSelectedOffer(offer);
                            const minimumQuantity = getOfferMinimumQuantity(offer);
                            const maximumQuantity = getOfferMaximumQuantity(offer);
                            const quantityLocked = status !== "idle" || isLoading || uploading || Boolean(pendingCheckoutOffer);

                            return (
                              <div
                                key={offer.actionKey}
                                className="rounded-2xl border border-white/10 bg-[#161616] p-3.5 shadow-inner flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="rounded-lg bg-[#1877F2]/15 border border-[#1877F2]/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#4e8df5]">
                                      {offer.platform} · #{offer.smmServiceId}
                                    </span>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                                      {status === "awaiting_target" ? "Waiting for link" :
                                        status === "awaiting_receipt" ? "Waiting for payment" :
                                        status === "purchased" ? "Purchased" :
                                        status === "cancelled" ? "Cancelled" :
                                        busy ? "Processing" : "Available"}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs font-black text-white leading-snug">
                                    {offer.name}
                                  </p>
                                </div>

                                <div className="mt-3 space-y-2.5">
                                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <label className="rounded-xl border border-white/10 bg-black/40 p-2 block">
                                      <span className="block text-zinc-400 font-bold uppercase text-[9px]">Quantity</span>
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        min={minimumQuantity}
                                        max={maximumQuantity ?? undefined}
                                        step={1}
                                        value={quantityInput}
                                        onChange={(e) => {
                                          setOfferQuantityInputs((curr) => ({
                                            ...curr,
                                            [offer.actionKey]: e.target.value,
                                          }));
                                        }}
                                        disabled={quantityLocked}
                                        className="mt-1 w-full bg-transparent text-xs font-black text-white outline-none"
                                      />
                                    </label>
                                    <div className="rounded-xl border border-[#1DB954]/20 bg-[#1DB954]/10 p-2 flex flex-col justify-center">
                                      <span className="block text-zinc-400 font-bold uppercase text-[9px]">
                                        {offer.vipDiscountPercent > 0 ? `VIP -${offer.vipDiscountPercent}%` : "Total Amount"}
                                      </span>
                                      <strong className="text-sm font-black text-[#1DB954]">
                                        {selectedOffer ? formatPhp(selectedOffer.total) : "Check qty"}
                                      </strong>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (selectedOffer) void handleBuyOffer(selectedOffer);
                                      }}
                                      disabled={!selectedOffer || status !== "idle" || isLoading || uploading || Boolean(pendingCheckoutOffer)}
                                      className="flex items-center justify-center gap-1.5 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                    >
                                      {busy ? <Loader2 size={12} className="animate-spin" /> :
                                        status === "purchased" ? <CheckCircle2 size={12} /> :
                                        <ShoppingCart size={12} />}
                                      {status === "purchased" ? "Bought" : "Buy Now"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelOffer(offer)}
                                      disabled={busy || terminal || status === "awaiting_receipt" || isLoading || uploading}
                                      className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-300 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                    >
                                      <Ban size={12} />
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {msg.offerCatalog?.mode === "all" && msg.id && (
                            <div className="col-span-full rounded-2xl border border-[#1DB954]/20 bg-[#1DB954]/5 p-3 text-center">
                              {msg.offerCatalog.hasMore && msg.offerCatalog.nextPage ? (
                                <button
                                  type="button"
                                  onClick={() => void handleLoadMoreOffers(msg.id!, msg.offerCatalog!)}
                                  disabled={Boolean(loadingOfferPages[msg.id]) || isLoading || uploading}
                                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] px-4 py-2 text-xs font-black uppercase tracking-wider text-black transition cursor-pointer"
                                >
                                  {loadingOfferPages[msg.id] ? <Loader2 size={14} className="animate-spin" /> : null}
                                  Show More Services ({msg.offerCatalog.totalCount} total)
                                </button>
                              ) : (
                                <p className="text-xs font-bold text-[#1DB954]">
                                  ✓ All {msg.offerCatalog.totalCount.toLocaleString()} services shown
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex w-full justify-start animate-in fade-in duration-200">
                <div className="mr-auto bg-[#1c1c1c] border border-white/10 text-white rounded-2xl rounded-bl-none px-4 py-2.5 text-xs font-bold flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[#1877F2]" /> PinoyBoosting AI is typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compressing Progress Banner */}
          {uploading && compressState && (
            <div className="px-4 py-2 bg-[#181818] border-t border-white/10">
              <div className="rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/10 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-[#4e8df5]">
                    <Loader2 size={12} className="animate-spin" />
                    {compressState.savedBytes > 0 ? "Receipt optimized" : "Compressing screenshot..."}
                  </span>
                  <span className="text-[#1DB954] font-bold">
                    {formatBytes(compressState.originalSize)} → {formatBytes(compressState.compressedSize)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1877F2] to-[#1DB954] transition-all duration-300"
                    style={{
                      width: `${compressState.savedBytes > 0 ? 100 : Math.max(15, Math.min(95, 15 + compressState.ratio * 80))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Chips Bar */}
          <div className="px-3 py-2 bg-[#181818] border-t border-white/10 flex gap-1.5 overflow-x-auto select-none no-scrollbar">
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest facebook followers")}
              disabled={isLoading || uploading}
              className="text-[11px] font-bold bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition active:scale-95 shrink-0 cursor-pointer"
            >
              🚀 FB Followers
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest facebook reactions")}
              disabled={isLoading || uploading}
              className="text-[11px] font-bold bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition active:scale-95 shrink-0 cursor-pointer"
            >
              ❤️ FB Reactions
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest tiktok followers")}
              disabled={isLoading || uploading}
              className="text-[11px] font-bold bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition active:scale-95 shrink-0 cursor-pointer"
            >
              📱 TikTok Followers
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest tiktok views")}
              disabled={isLoading || uploading}
              className="text-[11px] font-bold bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition active:scale-95 shrink-0 cursor-pointer"
            >
              🎥 TikTok Views
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest instagram followers")}
              disabled={isLoading || uploading}
              className="text-[11px] font-bold bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition active:scale-95 shrink-0 cursor-pointer"
            >
              📸 IG Followers
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest youtube subscribers")}
              disabled={isLoading || uploading}
              className="text-[11px] font-bold bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition active:scale-95 shrink-0 cursor-pointer"
            >
              ▶️ YT Subscribers
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me all smm services")}
              disabled={isLoading || uploading}
              className="text-[11px] font-bold bg-[#1DB954]/15 hover:bg-[#1DB954]/25 border border-[#1DB954]/30 text-[#1DB954] px-3 py-1.5 rounded-full transition active:scale-95 shrink-0 cursor-pointer"
            >
              ✨ All Services
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("how to pay with gcash or bank")}
              disabled={isLoading || uploading}
              className="text-[11px] font-bold bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition active:scale-95 shrink-0 cursor-pointer"
            >
              💳 GCash / Bank
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("who created pinoyboosting")}
              disabled={isLoading || uploading}
              className="text-[11px] font-bold bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition active:scale-95 shrink-0 cursor-pointer"
            >
              👨‍💻 Developer
            </button>
          </div>

          {/* Form Input Area */}
          <form onSubmit={handleSubmit} className="p-3 bg-[#181818] border-t border-white/10 flex gap-2 items-center">
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
              className={`p-2.5 rounded-xl border transition flex items-center justify-center shrink-0 cursor-pointer active:scale-95 ${
                pendingReceiptOrder 
                  ? "border-[#1DB954] bg-[#1DB954]/15 text-[#1DB954]" 
                  : "border-white/15 bg-black/40 text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
              title={pendingReceiptOrder ? `Upload payment proof for ${pendingReceiptOrder.trackingId}` : "Attach payment screenshot"}
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin text-[#1877F2]" />
              ) : (
                <ImageIcon size={18} />
              )}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder={
                uploading
                  ? (compressState ? "Compressing receipt..." : "Uploading receipt...")
                  : pendingCheckoutOffer
                    ? "Paste public target link (https://)..."
                    : pendingReceiptOrder
                      ? `Upload proof for ${pendingReceiptOrder.trackingId} (${formatPhp(pendingReceiptOrder.amount)})...`
                      : "Type message or paste Tracking ID..."
              }
              className="flex-1 px-4 py-2.5 bg-black/50 border border-white/15 text-white rounded-xl focus:outline-none focus:border-[#1877F2] text-sm font-medium placeholder-zinc-500"
              disabled={isLoading || uploading}
            />
            <button 
              type="submit" 
              disabled={isLoading || uploading || !input.trim()}
              className="bg-[#1877F2] hover:bg-[#166fe5] disabled:bg-white/10 disabled:text-zinc-600 text-white font-bold p-2.5 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
              title="Send message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
