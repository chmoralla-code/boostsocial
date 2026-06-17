/**
 * Dynamic Client-Side Image Compression Utility
 * Resizes and compresses images using canvas for extremely high storage efficiency.
 */
export function compressImage(file: File, maxDimension = 1200, quality = 0.7): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const TIMEOUT_MS = 30_000;
    const timeoutId = setTimeout(() => {
      reject(new Error("Image compression timed out."));
    }, TIMEOUT_MS);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
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

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          clearTimeout(timeoutId);
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            clearTimeout(timeoutId);
            if (blob) {
              const originalName = file.name;
              const dotIndex = originalName.lastIndexOf(".");
              const baseName = dotIndex !== -1 ? originalName.slice(0, dotIndex) : originalName;
              const newFileName = `${baseName}_optimized.jpg`;

              const compressedFile = new File([blob], newFileName, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(file);
      };
    };
    reader.onerror = () => {
      clearTimeout(timeoutId);
      resolve(file);
    };
  });
}
