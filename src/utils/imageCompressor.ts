/**
 * Dynamic Client-Side Image Compression Utility
 * Resizes and compresses images using canvas for extremely high storage efficiency.
 */

export type CompressResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  /** 0..1 fraction of bytes removed (0 = no reduction). */
  ratio: number;
  /** Width × height the image was resized to. */
  width: number;
  height: number;
  /** Milliseconds the compression took. */
  durationMs: number;
};

export type CompressProgress = {
  stage: "loading" | "resizing" | "encoding" | "done";
  /** 0..1 estimated progress for UI effects. */
  progress: number;
};

const DEFAULT_MAX_DIMENSION = 1200;
const DEFAULT_QUALITY = 0.7;

function loadImage(src: string, timeoutMs = 30_000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeoutId = setTimeout(() => {
      reject(new Error("Image compression timed out."));
    }, timeoutMs);
    image.onload = () => {
      clearTimeout(timeoutId);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Image failed to load for compression."));
    };
    image.src = src;
  });
}

function readAsDataURL(file: File, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Image read timed out."));
    }, timeoutMs);
    const reader = new FileReader();
    reader.onload = (event) => {
      clearTimeout(timeoutId);
      resolve(event.target?.result as string);
    };
    reader.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Image read failed."));
    };
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
  timeoutMs = 30_000
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(null), timeoutMs);
    canvas.toBlob(
      (blob) => {
        clearTimeout(timeoutId);
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Compress an image file in-browser and return a compact JPEG File plus
 * before/after byte stats so the UI can show a "compressing" effect with a
 * real size reduction readout (e.g. "3.2 MB → 410 KB").
 *
 * Falls back to the original file (with zero savings) when the input is not
 * an image, is already small, or compression doesn't help.
 */
export async function compressImageWithStats(
  file: File,
  options?: {
    maxDimension?: number;
    quality?: number;
    onProgress?: (progress: CompressProgress) => void;
  }
): Promise<CompressResult> {
  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options?.quality ?? DEFAULT_QUALITY;
  const onProgress = options?.onProgress;
  const startedAt = performance.now();

  const originalSize = file.size;

  if (!file.type.startsWith("image/")) {
    return finish(file, file.size, 0, 0);
  }

  try {
    onProgress?.({ stage: "loading", progress: 0.15 });
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    let width = img.width;
    let height = img.height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    onProgress?.({ stage: "resizing", progress: 0.45 });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return finish(file, originalSize, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    onProgress?.({ stage: "encoding", progress: 0.7 });
    const blob = await canvasToBlob(canvas, quality);
    if (!blob || blob.size >= originalSize) {
      return finish(file, originalSize, 0, width, height);
    }

    const originalName = file.name;
    const dotIndex = originalName.lastIndexOf(".");
    const baseName = dotIndex !== -1 ? originalName.slice(0, dotIndex) : originalName;
    const compressedFile = new File([blob], `${baseName}_optimized.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    onProgress?.({ stage: "done", progress: 1 });
    return finish(compressedFile, originalSize, blob.size, width, height);
  } catch (err) {
    console.error("Image compression failed, using original image:", err);
    return finish(file, originalSize, 0, 0);
  }

  function finish(
    file: File,
    original: number,
    compressed: number,
    width: number,
    height = 0
  ): CompressResult {
    const compressedSize = compressed || original;
    const savedBytes = Math.max(0, original - compressedSize);
    return {
      file,
      originalSize: original,
      compressedSize,
      savedBytes,
      ratio: original > 0 ? savedBytes / original : 0,
      width,
      height,
      durationMs: performance.now() - startedAt,
    };
  }
}

/**
 * Backward-compatible wrapper that returns just the compressed File.
 * Kept so existing call sites keep working.
 */
export function compressImage(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_QUALITY
): Promise<File> {
  return compressImageWithStats(file, { maxDimension, quality }).then(
    (result) => result.file
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
