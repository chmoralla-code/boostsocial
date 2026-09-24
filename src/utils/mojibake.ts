/**
 * Repairs "mojibake": UTF-8 text that was decoded as Windows-1252 somewhere
 * (typically a file or DB value saved from PowerShell/Excel), e.g. "â‚±" for
 * "₱", "â€“" for "–" and "ðŸš€" for "🚀".
 *
 * Only runs that decode to valid UTF-8 are rewritten, so correct text
 * (including real accented letters) is left untouched.
 */

// Windows-1252 bytes 0x80–0x9F that map to characters outside Latin-1.
const CP1252_TO_BYTE: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85,
  "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92,
  "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c,
  "ž": 0x9e, "Ÿ": 0x9f,
};

const CONTINUATION = "[\\u0080-\\u00BF\\u20AC\\u201A\\u0192\\u201E\\u2026\\u2020\\u2021\\u02C6\\u2030\\u0160\\u2039\\u0152\\u017D\\u2018\\u2019\\u201C\\u201D\\u2022\\u2013\\u2014\\u02DC\\u2122\\u0161\\u203A\\u0153\\u017E\\u0178]";
// A UTF-8 lead byte (0xC2–0xF4) followed by 1–3 continuation bytes, as they
// look after being mis-decoded as Windows-1252.
const MOJIBAKE_RUN = new RegExp(`[\\u00C2-\\u00F4]${CONTINUATION}{1,3}`, "g");
const QUICK_CHECK = /[Â-ô]/;

const decoder = new TextDecoder("utf-8", { fatal: true });

function toByte(char: string): number | null {
  const code = char.charCodeAt(0);
  if (code <= 0xff) return code;
  return CP1252_TO_BYTE[char] ?? null;
}

function decodeRun(run: string): string {
  const bytes: number[] = [];
  for (const char of run) {
    const byte = toByte(char);
    if (byte === null) return run;
    bytes.push(byte);
  }
  try {
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    return run;
  }
}

export function repairMojibake(text: string): string {
  if (!text || !QUICK_CHECK.test(text)) return text;
  // Text can be double-encoded ("Ã¢â€šÂ±"), so repeat until stable.
  let current = text;
  for (let pass = 0; pass < 3; pass++) {
    const next = current.replace(MOJIBAKE_RUN, decodeRun);
    if (next === current) break;
    current = next;
  }
  return current;
}

/** Repairs every string inside a value (objects, arrays, JSON-string fields). */
export function repairMojibakeDeep<T>(value: T): T {
  if (typeof value === "string") return repairMojibake(value) as T;
  if (Array.isArray(value)) return value.map((item) => repairMojibakeDeep(item)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = repairMojibakeDeep(item);
    }
    return out as T;
  }
  return value;
}
