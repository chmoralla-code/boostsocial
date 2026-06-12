export async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export function isDataUrl(value?: string | null) {
  return /^data:[^;]+;base64,/i.test(String(value || ""));
}
