import sharp from "sharp";

const MAX_RECEIPT_DIMENSION = 1280;
const RECEIPT_QUALITY = 72;
const TARGET_RECEIPT_BYTES = 900 * 1024;
const MIN_QUALITY = 35;
const QUALITY_STEP = 10;

export interface CompressedImage {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

function extensionForContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

/**
 * Server-side image compression for GCash proof of payment and receipts.
 *
 * Acts as the authoritative safety net: even when a client skips or fails
 * client-side compression, this guarantees receipts are resized and
 * re-encoded as compact JPEG before being written to Supabase Storage or
 * embedded as base64 in the database. This keeps Storage usage and DB row
 * sizes small on the Supabase Pro plan.
 */
export async function compressReceiptImage(
  file: File | Blob,
  options?: {
    maxDimension?: number;
    targetBytes?: number;
    quality?: number;
  }
): Promise<CompressedImage> {
  const maxDimension = options?.maxDimension ?? MAX_RECEIPT_DIMENSION;
  const targetBytes = options?.targetBytes ?? TARGET_RECEIPT_BYTES;
  const initialQuality = options?.quality ?? RECEIPT_QUALITY;

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const contentType = (file as File).type || "";

  if (!contentType.startsWith("image/")) {
    return {
      buffer: inputBuffer,
      mimeType: contentType || "application/octet-stream",
      extension: extensionForContentType(contentType),
    };
  }

  try {
    const pipeline = sharp(inputBuffer, { failOn: "none" })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });

    let quality = initialQuality;
    let output = await pipeline.clone().jpeg({ quality }).toBuffer();

    while (output.byteLength > targetBytes && quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
      output = await pipeline.clone().jpeg({ quality }).toBuffer();
    }

    return {
      buffer: output,
      mimeType: "image/jpeg",
      extension: "jpg",
    };
  } catch (err) {
    console.error("Server-side receipt compression failed, using original:", err);
    return {
      buffer: inputBuffer,
      mimeType: contentType,
      extension: extensionForContentType(contentType),
    };
  }
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
