"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
import NextImage from "next/image";
import { X, Send, Loader2, Image as ImageIcon, ShoppingCart, Ban, CheckCircle2 } from "lucide-react";
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
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi, welcome to PinoyBoosting. Tell me what you need, like Facebook followers, reactions, GCash help, or send a Tracking ID and I can check it for you.' }
  ]);
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

  const markAdminRepliesRead = useCallback((emailToMark: string) => {
    fetch("/api/chat/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailToMark, reader: "customer" })
    }).catch((err) => console.error("Error marking admin replies as read:", err));
  }, []);

  // ── Realtime chat plumbing ──────────────────────────────────────────────────
  // Supabase Realtime streams new customer_messages rows to this chathead so
  // admin replies appear instantly without polling. A slow 30s backstop poll
  // (below) catches anything the realtime channel misses.
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
  }, []);

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
        // Suppress the echo of a message we just appended locally (customer's
        // own message or the system reply we saved right after rendering it).
        const echo = localEchoRef.current.find(
          (e) => e.role === role && e.content === row.message && now - e.ts < 8000
        );
        if (echo) {
          seenIdsRef.current.add(row.id);
          // Stamp the matching local bubble with the DB id so later history
          // merges stay stable and do not duplicate or reorder it.
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
      if (isOpenRef.current) {
        if (customerEmailRef.current) markAdminRepliesRead(customerEmailRef.current);
        setUnreadAdminCount(0);
        setAdminNotice("");
      } else {
        setUnreadAdminCount((c) => c + 1);
        setAdminNotice(row.message);
      }
    },
    [markAdminRepliesRead]
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

  // 1. Initial Email Session Resolution
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

  // 2. Load chat history once on email connect, then backstop Realtime with a
  //    slow 30s poll that catches any row the realtime channel missed and keeps
  //    the unread badge in sync with the database.
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
            // Keep in-flight local bubbles (not yet in DB) after history so
            // chronological order stays: older DB rows, then newest local sends.
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
          // Backstop catch-up for rows Realtime missed.
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
      alert("⚠️ Tracking ID not found!\n\nPlease enter your Tracking ID (e.g. BS-D5D1D849) in the text input box first before uploading/pasting your GCash screenshot so we can match it to your order.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    const displayId = `BS-${resolvedId.slice(0, 8).toUpperCase()}`;
    pushLocalMessage({ role: 'user', content: `[Attached GCash Receipt Screenshot for Order ${displayId}]` });

    try {
      // Client-side compression saves upload bandwidth and gives the user a
      // live "compressing" effect with a real before/after byte readout. The
      // server re-compresses as a safety net regardless.
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
          // Drive the progress bar via the ratio field (0 → 1) as the image
          // loads, resizes, and encodes to a compact JPEG.
          setCompressState((prev) =>
            prev ? { ...prev, ratio: p.progress } : prev
          );
        },
      });
      setCompressState(result);
      // Briefly show the final compressed size, then clear after upload starts.
      setTimeout(() => setCompressState(null), 2500);

      const formData = new FormData();
      formData.append("file", result.file);
      formData.append("orderId", resolvedId);

      // Route the file upload through the secure Next.js server API endpoint
      const res = await fetch("/api/upload-receipt", {
        method: "POST",
        body: formData
      });

      const uploadData = await res.json() as {
        error?: string;
        receiptAnalysis?: {
          model?: string;
          decision?: "approved" | "rejected_fake" | "rejected_duplicate" | "manual_review";
          verified?: boolean;
          autoApproved?: boolean;
          extractedAmount?: number | null;
          amountMatches?: boolean | null;
          receiverName?: string | null;
          receiverMatched?: boolean;
          referenceNumber?: string | null;
          referenceUnique?: boolean;
          reason?: string;
          requiresManualReview?: boolean;
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
        ? `\n\n✅ **Kimi approved the proof:** ${receiptAmount}, receiver **${analysis.receiverName || "Henry S."}**, and a unique GCash Ref No. all matched. Your order is now processing.`
        : analysis?.decision === "rejected_fake"
          ? `\n\n❌ **Kimi rejected the proof:** strong signs of an AI-generated or altered receipt were detected. ${analysis.reason || ""}`.trim()
          : analysis?.decision === "rejected_duplicate"
            ? `\n\n❌ **Kimi rejected the proof:** that GCash Ref No. was already used on another active transaction.`
            : `\n\n🔎 **Kimi sent this for manual review:** ${analysis?.reason || "The receiver, reference number, or amount could not be fully confirmed."}`;
      // Add success response from AI
      pushLocalMessage({
        role: 'assistant',
        content: `🎉 **Receipt screenshot successfully received!**\n\nIt has been automatically linked to **Tracking ID: ${displayId}**.${aiReviewNote}${analysis?.decision === "manual_review" ? "\n\nAdmin has been notified and can approve or reject it from the existing review flow." : ""}${savedLabel ? `\n\n📦 Image optimized${savedLabel}.`
 : ""}`
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
        content: "🔐 **Please sign in first.** Direct wallet purchases and GCash receipt uploads must be linked to your PinoyBoosting account. After signing in, return here and tap Buy again.",
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
      balance?: number;
      requiredAmount?: number;
      shortfall?: number;
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
      content: `💳 **Your wallet balance is not enough, so it was not charged.**\n\nI created **${trackingId}** for GCash payment.\n\n* **Pay exactly:** ${formatPhp(amount)}\n* **GCash:** 09505339963\n* **Receiver:** Henry S.\n\nAfter paying, tap the image button below and upload the GCash proof. Kimi will check the receiver, unique Ref No., amount, and visible signs of a fake or altered receipt.`,
    });
  };

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
          const reply = `🔍 **Order Status Details:**\n\n* **Tracking ID:** ${displayId}\n* **Service:** ${data.services?.title}\n* **Quantity:** ${data.quantity.toLocaleString()} items\n* **Target URL:** ${data.target_url}\n* **Amount:** ₱${Number(data.amount).toFixed(2)}\n* **Status:** **${data.status}**\n\n${
            data.status === 'Pending' 
              ? 'Your order is currently **Pending** verification. Once your GCash payment screenshot is uploaded (click 📷 or paste it here!), our team will verify and start full delivery shortly! 🚀' 
              : data.status === 'Processing' 
              ? 'Your order is currently **Processing** and active! Results are being delivered to your target link. ⚡' 
              : data.status === 'Completed' 
              ? 'Your order has been successfully **Completed**! All amplification quantities have been delivered. Thank you! 🎉' 
              : data.status === 'Rejected'
              ? 'Your order status is **Rejected**. Please contact support if you believe this is an error.'
              : 'Your order status is **Cancelled**. Please contact support if you believe this is an error.'
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
          const notFoundReply = `❌ **Order ID Not Found**\n\nI couldn't locate any order with ID: **${checkId}**.\n\nPlease double-check the ID or copy it directly from your checkout success modal and try again!`;
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

      // 2. Call Pollinations AI for general chatbot messages (Free, unlimited, no API key required)
      const servicesCatalogText = dbServices.length > 0
        ? dbServices.map(srv => {
            let minQtyStr = "";
            let freeTrialStr = "";
            try {
              const parsed = parseDescription(srv.description);
              if (parsed) {
                if (parsed.min_qty) minQtyStr = ` (Min order: ${parsed.min_qty})`;
                if (parsed.free_trial_amount) freeTrialStr = ` (Free Trial: ${parsed.free_trial_amount} units available!)`;
              }
            } catch {}
            
            const isSingleSrv = 
              srv.title.toLowerCase().includes("page") || 
              srv.title.toLowerCase().includes("gemini") || 
              srv.title.toLowerCase().includes("eap") || 
              srv.title.toLowerCase().includes("tplink") || 
              srv.title.toLowerCase().includes("software") || 
              srv.title.toLowerCase().includes("architectural") || 
              srv.title.toLowerCase().includes("license") ||
              srv.id === "03185a81-49f3-4255-868e-9e9ec3189497";
              
            if (isSingleSrv) {
              return `- **${srv.title}:** ₱${Number(srv.starting_price).toFixed(2)} per unit.${minQtyStr}${freeTrialStr}`;
            }
            const perThousandPrice = Number(srv.starting_price) * 1000;
            return `- **${srv.title}:** ₱${perThousandPrice.toFixed(2)} per 1,000 units.${minQtyStr}${freeTrialStr}`;
          }).join('\n')
        : `- Facebook Followers: ₱10 per 1,000 followers.\n- Post Reactions (Likes, Hearts, etc.): ₱5 per 1,000 reactions.\n- Video Views (for Reels, Stories, etc.): ₱13 per 1,000 views.`;

      const systemContext = `You are a friendly, natural, and conversational customer support agent for PinoyBoosting (developed by Cyrhiel Moralla). Avoid sounding robotic, cold, or artificial. Answer questions like a real human support desk representative who is warm, welcoming, and direct. Use natural Taglish (Tagalog-English mix) or Bisaya where appropriate to sound friendly and approachable to local clients. Keep replies brief (1-3 sentences max) unless the customer asks for detail. You can answer general questions outside PinoyBoosting too; for non-service questions, answer normally. Start with the answer, then give the next step.

Our live real-time core services and pricing catalog (fetched dynamically from our active database):
${servicesCatalogText}

CYNETWORK CRITICAL STORE POLICIES & INFORMATION:
1. **Developer Handshake:** This entire platform is designed and developed by Cyrhiel Moralla. He manually verifies payments, supports architectural setups, and handles support.
2. **50 Free Trial:** We provide 50 free trial followers, reactions, or views so clients can test our speed before paying! Fully transparent.
3. **100% Monetization & Adsense Compliant:** CYNETWORK filters out toxic spam bots that direct panels deliver. We guarantee 100% compliance with Adsense, page monetization, and ads guidelines.
4. **PH Base Organic Notice:** Philippine-based organic local follower services take time to source verified PH profiles. They take up to 24 hours to deliver but ensure maximum retention.
5. **GCash QR Payments:** Clients pay directly using GCash. They upload the screenshot receipt here or send their Tracking ID in chat for instant manual verification.
6. **Refund Guarantee:** Orders that fail to process or start are instantly credited back to the customer's wallet balance.
7. **Status Tracking:** Every order has a Tracking ID (e.g. BS-D5D1D849). Typing it in this chathead instantly queries our live database status (Pending, Processing, Completed).
8. **Why we win against direct panels like RixeySMM:** Standard wholesale panels require crypto, provide zero Taglish support, and deliver foreign bots that trigger page bans. CYNETWORK has GCash support, Taglish developer care, and safety filtering.

Tone rules:
- Use the customer's words where possible, like "No worries", "Got you", or "Sure" only when it feels natural.
- If the question is vague, ask one simple follow-up instead of dumping a long menu.
- Never invent prices, order statuses, discounts, timelines, or policies.
- Format list items on separate lines with simple bullets (e.g. * **Item:** text) only when a list is genuinely helpful. Always keep answers warm, human-like, concise, and fully aligned with CYNETWORK policies.`;

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
        console.error("Failed to query server AI route:", fetchErr);
      }

      if (!responseText) {
        // Safe, smart local fallback context based on user keywords
        const text = userMsg.toLowerCase();
        if (text.includes("price") || text.includes("cost") || text.includes("magkano") || text.includes("pricing") || text.includes("package")) {
          responseText = `Sure. Prices depend on the exact service and quantity, so the best step is to open SERVICES and pick the package that matches your goal.\n\nTell me the platform, like Facebook followers or TikTok views, and I can narrow it down for you.`;
        } else if (text.includes("payment") || text.includes("gcash") || text.includes("bayad")) {
          responseText = `Yes, GCash is accepted. After checkout, upload the receipt screenshot here or on the payment step so admin can verify it and start processing your order.`;
        } else if (text.includes("who") || text.includes("owner") || text.includes("create") || text.includes("develop") || text.includes("make")) {
          responseText = `PinoyBoosting/CYNETWORK was created and developed by **Cyrhiel Moralla**. He also handles manual verification and support workflows.`;
        } else {
          responseText = `Got you. Tell me what you want to grow or set up, like followers, reactions, views, PisoWiFi, or wallet top-up. If you have an order already, send a Tracking ID like BS-D5D1D849 and I can check it.`;
        }
      }

      pushLocalMessage({ role: 'assistant', content: responseText });

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

    } catch (err: unknown) {
      console.error(err);
      pushLocalMessage({ role: 'assistant', content: `Sorry, I had trouble connecting for a moment. Please try again, or send your Tracking ID if you want me to check an order.` });
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
      {!isOpen && unreadAdminCount > 0 && (
        <button
          type="button"
          onClick={() => openSupportChat()}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] right-3 z-50 max-w-[250px] rounded-2xl border border-red-400/25 bg-card px-4 py-3 text-left shadow-2xl shadow-red-500/10 transition-all hover:border-red-400/45 hover:bg-elevated sm:bottom-24 sm:right-6"
        >
          <span className="block text-[10px] font-black uppercase tracking-widest text-red-300">
            Admin replied
          </span>
          <span className="mt-1 block truncate text-xs font-semibold text-fg">
            {adminNotice || "Open chat to read the message."}
          </span>
        </button>
      )}

      {/* Floating Button */}
      <button 
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            openSupportChat();
          }
        }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 z-50 flex h-12 w-12 items-center justify-center overflow-visible rounded-full shadow-[0_0_20px_rgba(24,119,242,0.4)] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_25px_rgba(24,119,242,0.6)] focus:outline-none group sm:bottom-6 sm:right-6 sm:h-[60px] sm:w-[60px]"
        aria-label={isOpen ? "Close support chat" : "Open support chat"}
      >
        {isOpen ? (
          <div className="bg-[#1877F2] hover:bg-[#4e8df5] text-white w-full h-full rounded-full flex items-center justify-center transition-all duration-300">
            <X size={24} className="transition-transform duration-300 group-hover:rotate-90" />
          </div>
        ) : (
          <div className="relative w-full h-full rounded-full p-0.5 bg-gradient-to-tr from-[#1877F2] via-blue-500 to-[#4e8df5] flex items-center justify-center">
            {/* Online Indicator Badge */}
            {unreadAdminCount > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 z-20 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#121212] bg-red-500 px-1 text-[10px] font-black text-white shadow-lg">
                {unreadAdminCount > 9 ? "9+" : unreadAdminCount}
              </span>
            ) : (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 z-10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1877F2] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#1877F2] border-2 border-[#121212]"></span>
              </span>
            )}
            <div className="w-full h-full rounded-full overflow-hidden bg-[#181818] flex items-center justify-center">
              <NextImage
                src="/chathead-face.png" 
                alt="Support Face" 
                width={60}
                height={60}
                className="w-full h-full object-cover select-none pointer-events-none group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] left-3 right-3 z-50 h-[500px] max-h-[78vh] bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden sm:left-auto sm:bottom-24 sm:right-6 sm:w-96 sm:max-h-[80vh]">
          {/* Header */}
          <div className="bg-elevated border-b border-border p-4 text-fg flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm tracking-tight text-fg">CY<span className="text-[#1DB954]">NETWORK</span> Support</h3>
              <p className="text-[10px] text-[#1877F2] font-semibold mt-0.5 tracking-wider uppercase">DeepSeek V4 Flash · Kimi Receipt Vision</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-muted hover:text-fg transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Email Support Sync sub-header */}
          {!customerEmail ? (
            <div className="bg-card border-b border-border p-3 text-xs text-fg flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1DB954]">💬 Live Support Chat Available!</span>
                <span className="text-[9px] text-muted font-extrabold uppercase tracking-wide">Sync Account</span>
              </div>
              <p className="text-[10px] text-muted leading-normal">Link your email to instantly message our admin desk and load your previous message history!</p>
              <div className="flex gap-1.5 mt-0.5">
                <input
                  type="email"
                  placeholder="Enter email to connect..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="flex-1 bg-elevated border border-border text-fg rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#1DB954] font-medium"
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
                  className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#1DB954]/5 border-b border-[#1DB954]/15 p-2.5 px-4 flex items-center justify-between text-muted text-[10px] font-bold flex-shrink-0">
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
                    setUnreadAdminCount(0);
                    setAdminNotice("");
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

          {/* Messages — user bubbles hug the right; AI/support hugs the left */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-elevated">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const maxWidth = msg.offers?.length ? "max-w-[92%]" : isUser ? "max-w-[75%]" : "max-w-[82%]";
              return (
              <div
                key={msg.id || `local-${msg.role}-${msg.createdAt ?? i}-${i}`}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`${maxWidth} ${isUser ? "ml-auto" : "mr-auto"} rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words ${
                    isUser
                      ? "bg-[#1877F2] text-white font-semibold rounded-br-none"
                      : "bg-card border border-border/60 text-fg rounded-bl-none"
                  }`}
                >
                  <span className={`mb-1 block text-[9px] font-black uppercase tracking-widest ${
                    isUser ? "text-white/70 text-right" : "text-muted"
                  }`}>
                    {isUser ? "You" : "Support"}
                  </span>
                  {renderMessageContent(msg.content, isUser)}
                  {msg.offers?.length ? (
                    <div className="mt-3 space-y-2.5">
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
                            className="rounded-xl border border-[#1877F2]/25 bg-elevated/80 p-3 shadow-inner"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded-full bg-[#1877F2]/12 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#4e8df5]">
                                {offer.platform} · SMM #{offer.smmServiceId}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
                                {status === "awaiting_target" ? "Waiting for link" :
                                  status === "awaiting_receipt" ? "Waiting for GCash proof" :
                                  status === "purchased" ? "Purchased" :
                                  status === "cancelled" ? "Cancelled" :
                                  busy ? "Checking out" : "Live offer"}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs font-black leading-snug text-fg">
                              {offer.name}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                              <label
                                className={`rounded-lg border bg-card px-2 py-1.5 transition ${
                                  selectedOffer ? "border-border/60 focus-within:border-[#1877F2]/70" : "border-red-400/50"
                                }`}
                              >
                                <span className="block text-muted">Quantity</span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={minimumQuantity}
                                  max={maximumQuantity ?? undefined}
                                  step={1}
                                  value={quantityInput}
                                  onChange={(event) => {
                                    setOfferQuantityInputs((current) => ({
                                      ...current,
                                      [offer.actionKey]: event.target.value,
                                    }));
                                  }}
                                  disabled={quantityLocked}
                                  aria-label={`Quantity for ${offer.name}`}
                                  aria-invalid={!selectedOffer}
                                  className="mt-0.5 w-full bg-transparent text-xs font-black text-fg outline-none disabled:cursor-not-allowed disabled:opacity-70"
                                />
                                <span className="mt-0.5 block text-[8px] text-muted">
                                  Min {minimumQuantity.toLocaleString()}
                                  {maximumQuantity !== null ? ` · Max ${maximumQuantity.toLocaleString()}` : ""}
                                </span>
                              </label>
                              <div className="rounded-lg border border-[#1DB954]/20 bg-[#1DB954]/5 px-2 py-1.5">
                                <span className="block text-muted">
                                  {offer.vipDiscountPercent > 0 ? `Est. VIP -${offer.vipDiscountPercent}%` : "Estimated total"}
                                </span>
                                <strong className={selectedOffer ? "text-[#1DB954]" : "text-red-300"}>
                                  {selectedOffer ? formatPhp(selectedOffer.total) : "Check quantity"}
                                </strong>
                              </div>
                            </div>
                            {!selectedOffer ? (
                              <p className="mt-1.5 text-[9px] font-semibold text-red-300" role="alert">
                                Enter a whole number from {minimumQuantity.toLocaleString()}
                                {maximumQuantity !== null ? ` to ${maximumQuantity.toLocaleString()}` : " or higher"}.
                              </p>
                            ) : null}
                            <p className="mt-2 text-[9px] leading-relaxed text-muted">
                              {formatPhp(offer.pricePerThousand)} per 1,000 · final price re-checked before payment
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedOffer) void handleBuyOffer(selectedOffer);
                                }}
                                disabled={!selectedOffer || status !== "idle" || isLoading || uploading || Boolean(pendingCheckoutOffer)}
                                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1DB954] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {busy ? <Loader2 size={12} className="animate-spin" /> :
                                  status === "purchased" ? <CheckCircle2 size={12} /> :
                                  <ShoppingCart size={12} />}
                                {status === "purchased" ? "Bought" : "Buy"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelOffer(offer)}
                                disabled={busy || terminal || status === "awaiting_receipt" || isLoading || uploading}
                                className="flex items-center justify-center gap-1.5 rounded-lg border border-red-400/25 bg-red-500/5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Ban size={12} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {msg.offerCatalog?.mode === "all" && msg.id ? (
                        <div className="rounded-xl border border-[#1DB954]/20 bg-[#1DB954]/5 p-2.5 text-center">
                          {msg.offerCatalog.hasMore && msg.offerCatalog.nextPage ? (
                            <button
                              type="button"
                              onClick={() => void handleLoadMoreOffers(msg.id!, msg.offerCatalog!)}
                              disabled={
                                Boolean(loadingOfferPages[msg.id]) ||
                                isLoading ||
                                uploading ||
                                Boolean(pendingCheckoutOffer)
                              }
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1DB954] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {loadingOfferPages[msg.id] ? <Loader2 size={12} className="animate-spin" /> : null}
                              {loadingOfferPages[msg.id]
                                ? "Loading services"
                                : `Show ${Math.min(msg.offerCatalog.pageSize, msg.offerCatalog.totalCount - msg.offerCatalog.page * msg.offerCatalog.pageSize)} more`}
                            </button>
                          ) : (
                            <p className="text-[9px] font-black uppercase tracking-wider text-[#1DB954]">
                              All {msg.offerCatalog.totalCount.toLocaleString()} matching services shown
                            </p>
                          )}
                          <p className="mt-1.5 text-[9px] text-muted">
                            {Math.min(
                              msg.offerCatalog.page * msg.offerCatalog.pageSize,
                              msg.offerCatalog.totalCount
                            ).toLocaleString()} of {msg.offerCatalog.totalCount.toLocaleString()} services
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              );
            })}
            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="mr-auto bg-card border border-border/60 text-fg rounded-2xl rounded-bl-none px-4 py-2 text-sm flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-[#1877F2]" /> Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compressing effect banner — shown while a GCash receipt is being
              shrunk client-side before upload. */}
          {uploading && compressState && (
            <div className="px-3 pt-2 bg-elevated">
              <div className="rounded-xl border border-[#1877F2]/25 bg-[#1877F2]/10 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-[#1877F2]">
                    <Loader2 size={12} className="animate-spin" />
                    {compressState.savedBytes > 0 ? "Receipt optimized" : "Compressing receipt..."}
                  </span>
                  {compressState.savedBytes > 0 ? (
                    <span className="text-[#1DB954] font-black tabular-nums">
                      {formatBytes(compressState.originalSize)} → {formatBytes(compressState.compressedSize)}
                    </span>
                  ) : (
                    <span className="text-muted tabular-nums">{formatBytes(compressState.originalSize)}</span>
                  )}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1877F2]/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1877F2] to-[#4e8df5] transition-[width] duration-300"
                    style={{
                      width: `${compressState.savedBytes > 0 ? 100 : Math.max(12, Math.min(90, 12 + compressState.ratio * 80))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          {/* Quick Action Chips */}
          <div className="px-3 py-2 bg-elevated border-t border-border/50 flex gap-2 overflow-x-auto select-none no-scrollbar">
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest facebook followers")}
              disabled={isLoading || uploading || Boolean(pendingCheckoutOffer)}
              className="text-[11px] font-semibold bg-card hover:bg-elevated border border-border text-fg hover:text-fg px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              Facebook Followers
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest instagram followers")}
              disabled={isLoading || uploading || Boolean(pendingCheckoutOffer)}
              className="text-[11px] font-semibold bg-card hover:bg-elevated border border-border text-fg hover:text-fg px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              Instagram Followers
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest tiktok followers")}
              disabled={isLoading || uploading || Boolean(pendingCheckoutOffer)}
              className="text-[11px] font-semibold bg-card hover:bg-elevated border border-border text-fg hover:text-fg px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              TikTok Followers
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me cheapest youtube subscribers")}
              disabled={isLoading || uploading || Boolean(pendingCheckoutOffer)}
              className="text-[11px] font-semibold bg-card hover:bg-elevated border border-border text-fg hover:text-fg px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              YouTube Subscribers
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("show me all smm services")}
              disabled={isLoading || uploading || Boolean(pendingCheckoutOffer)}
              className="text-[11px] font-semibold bg-[#1DB954]/10 hover:bg-[#1DB954]/15 border border-[#1DB954]/25 text-[#1DB954] px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              All SMM Services
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction("track my order")}
              disabled={isLoading || uploading || Boolean(pendingCheckoutOffer)}
              className="text-[11px] font-semibold bg-card hover:bg-elevated border border-border text-fg hover:text-fg px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              🔍 Track Order
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-3 bg-card border-t border-border flex gap-2 items-center">
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
              className={`${pendingReceiptOrder ? "border-[#1DB954]/50 bg-[#1DB954]/10 text-[#1DB954]" : "border-slate-700/80 bg-card text-muted"} hover:bg-elevated border hover:text-fg p-2.5 rounded-xl transition-colors flex items-center justify-center flex-shrink-0`}
              title={pendingReceiptOrder ? `Upload GCash proof for ${pendingReceiptOrder.trackingId}` : "Attach GCash Screenshot"}
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin text-[#1877F2]" />
              ) : (
                <ImageIcon size={16} />
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
                    ? "Paste the public target link or type cancel..."
                    : pendingReceiptOrder
                      ? `Upload proof for ${pendingReceiptOrder.trackingId} (${formatPhp(pendingReceiptOrder.amount)})...`
                      : "Type message or paste screenshot..."
              }
              className="flex-1 px-4 py-2 bg-card border border-slate-700/80 text-fg rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1877F2] text-sm font-medium placeholder-muted"
              disabled={isLoading || uploading}
            />
            <button 
              type="submit" 
              disabled={isLoading || uploading || !input.trim()}
              className="bg-[#1877F2] hover:bg-[#4e8df5] disabled:bg-slate-800 text-fg font-bold p-2.5 rounded-xl transition-colors flex items-center justify-center flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
