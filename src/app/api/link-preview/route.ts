import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;

type FramePolicy = {
  embeddable: boolean;
  reason: string | null;
};

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();

  if (normalized.startsWith("::ffff:")) {
    return isPrivateAddress(normalized.slice(7));
  }

  if (isIP(address) === 4) {
    const parts = address.split(".").map((part) => Number(part));
    const [a, b] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  if (isIP(address) === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return false;
}

async function assertPublicHttpUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https links can be previewed.");
  }

  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) {
    throw new Error("Private network links cannot be previewed.");
  }

  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((address) => isPrivateAddress(address.address))) {
    throw new Error("Private network links cannot be previewed.");
  }
}

async function fetchPublicUrl(url: URL, redirectCount = 0): Promise<{ response: Response; finalUrl: URL }> {
  await assertPublicHttpUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; BoostSocialLinkPreview/1.0; +https://fboosting.vercel.app)",
      },
    });

    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      if (redirectCount >= MAX_REDIRECTS) {
        return { response, finalUrl: url };
      }

      return fetchPublicUrl(new URL(location, url), redirectCount + 1);
    }

    return { response, finalUrl: url };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function getMetaContent(html: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta\\s+(?:[^>]*(?:name|property)=["']${escapedKey}["'][^>]*content=["']([^"']*)["']|[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${escapedKey}["'])[^>]*>`,
    "i"
  );
  const match = html.match(regex);
  return match ? decodeEntities((match[1] || match[2] || "").trim()) : "";
}

function extractTitle(html: string) {
  const ogTitle = getMetaContent(html, "og:title");
  if (ogTitle) return ogTitle;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? decodeEntities(titleMatch[1].replace(/\s+/g, " ").trim()) : "";
}

function extractFramePolicy(headers: Headers, appOrigin: string): FramePolicy {
  const xFrameOptions = headers.get("x-frame-options")?.toLowerCase() || "";
  if (xFrameOptions.includes("deny") || xFrameOptions.includes("sameorigin")) {
    return { embeddable: false, reason: "Target blocks embedded previews." };
  }

  const csp = headers.get("content-security-policy") || "";
  const frameAncestors = csp.match(/frame-ancestors\s+([^;]+)/i)?.[1]?.trim();
  if (!frameAncestors) {
    return { embeddable: true, reason: null };
  }

  const normalizedPolicy = frameAncestors.toLowerCase();
  if (normalizedPolicy.includes("*") || normalizedPolicy.includes(appOrigin.toLowerCase())) {
    return { embeddable: true, reason: null };
  }

  return { embeddable: false, reason: "Target blocks embedded previews." };
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url") || "";
  const appOrigin = request.nextUrl.origin;

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid preview link." }, { status: 400 });
  }

  try {
    const { response, finalUrl } = await fetchPublicUrl(targetUrl);
    const contentType = response.headers.get("content-type") || "";
    const html = contentType.toLowerCase().includes("text/html") ? await response.text() : "";
    const framePolicy = extractFramePolicy(response.headers, appOrigin);
    const image = getMetaContent(html, "og:image") || getMetaContent(html, "twitter:image");

    return NextResponse.json(
      {
        url: targetUrl.toString(),
        finalUrl: finalUrl.toString(),
        reachable: response.status >= 200 && response.status < 400,
        status: response.status,
        contentType,
        title: extractTitle(html) || finalUrl.hostname,
        description:
          getMetaContent(html, "og:description") ||
          getMetaContent(html, "description") ||
          getMetaContent(html, "twitter:description"),
        image: image ? new URL(image, finalUrl).toString() : "",
        embeddable: framePolicy.embeddable,
        reason: framePolicy.reason,
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview check failed.";

    return NextResponse.json(
      {
        url: targetUrl.toString(),
        finalUrl: targetUrl.toString(),
        reachable: false,
        status: 0,
        contentType: "",
        title: targetUrl.hostname,
        description: "",
        image: "",
        embeddable: false,
        reason: message,
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
