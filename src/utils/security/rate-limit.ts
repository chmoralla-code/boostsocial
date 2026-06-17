import { NextRequest, NextResponse } from "next/server";

type RateLimitConfig = {
  key: string;
  maxRequests: number;
  windowMs: number;
};

type RateEntry = {
  count: number;
  resetAt: number;
};

const requestBuckets = new Map<string, RateEntry>();

let lastCleanup = 0;
const CLEANUP_INTERVAL = 60_000;

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of requestBuckets) {
    if (entry.resetAt <= now) {
      requestBuckets.delete(key);
    }
  }
}

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown-ip";
}

export function enforceRateLimit(req: NextRequest, config: RateLimitConfig) {
  const now = Date.now();
  cleanupExpiredBuckets(now);
  const bucketKey = `${config.key}:${getClientIp(req)}`;
  const existing = requestBuckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    requestBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return null;
  }

  if (existing.count >= config.maxRequests) {
    const retryAfterSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);
    return NextResponse.json(
      {
        error: "Too many requests. Please slow down and try again shortly.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  existing.count += 1;
  requestBuckets.set(bucketKey, existing);
  return null;
}
