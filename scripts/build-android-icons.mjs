/**
 * Regenerates all Android launcher icons and splash screens from the brand
 * artwork in public/icon-512.png (green rounded square + white "P").
 *
 * Usage: node scripts/build-android-icons.mjs
 *
 * Produces, inside android/app/src/main/res:
 *  - mipmap-<density>/ic_launcher.png + ic_launcher_round.png   (legacy launchers)
 *  - mipmap-<density>/ic_launcher_foreground.png                (adaptive icon foreground)
 *  - drawable<suffix>/splash.png                          (branded splash screens)
 */
import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RES = join(ROOT, "android", "app", "src", "main", "res");
const SOURCE = join(ROOT, "public", "icon-512.png");

const BRAND_GREEN = "#22C55E";
const SPLASH_BG = "#0a0a0a";

// ---------------------------------------------------------------------------
// 1. Extract the white "P" from the source icon as a transparent PNG.
// ---------------------------------------------------------------------------
const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels } = info;

const out = Buffer.alloc(W * H * 4);
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * channels;
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    // "Whiteness" of a pixel: green (#22C55E) has min(r,g,b)=34, white=255.
    const whiteness = Math.max(0, Math.min(255, (Math.min(r, g, b) - 50) * (255 / 205)));
    const alpha = Math.round((whiteness / 255) * a);
    const o = (y * W + x) * 4;
    out[o] = 255; out[o + 1] = 255; out[o + 2] = 255; out[o + 3] = alpha;
    if (alpha > 128) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}

const pad = 4;
const cropLeft = Math.max(0, minX - pad);
const cropTop = Math.max(0, minY - pad);
const cropWidth = Math.min(W - cropLeft, maxX - minX + 1 + pad * 2);
const cropHeight = Math.min(H - cropTop, maxY - minY + 1 + pad * 2);
console.log(`Extracted P bbox ${cropWidth}x${cropHeight} at (${cropLeft},${cropTop})`);

const pPng = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
  .png()
  .toBuffer();

const pAspect = cropWidth / cropHeight;

// ---------------------------------------------------------------------------
// 2. Helpers to compose branded art.
// ---------------------------------------------------------------------------
const renderP = async (height) => {
  const width = Math.max(1, Math.round(height * pAspect));
  return sharp(pPng).resize(width, height, { fit: "fill" }).png().toBuffer();
};

const circleSvg = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${BRAND_GREEN}"/></svg>`
  );

const roundedSquareSvg = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${(size * 0.22).toFixed(1)}" fill="${BRAND_GREEN}"/></svg>`
  );

const composeCircleIcon = async (size, pRatio) => {
  const pHeight = Math.round(size * pRatio);
  const p = await renderP(pHeight);
  const pWidth = Math.max(1, Math.round(pHeight * pAspect));
  return sharp(circleSvg(size))
    .composite([{ input: p, left: Math.round((size - pWidth) / 2), top: Math.round((size - pHeight) / 2) }])
    .png()
    .toBuffer();
};

const composeRoundedIcon = async (size, pRatio) => {
  const pHeight = Math.round(size * pRatio);
  const p = await renderP(pHeight);
  const pWidth = Math.max(1, Math.round(pHeight * pAspect));
  return sharp(roundedSquareSvg(size))
    .composite([{ input: p, left: Math.round((size - pWidth) / 2), top: Math.round((size - pHeight) / 2) }])
    .png()
    .toBuffer();
};

// ---------------------------------------------------------------------------
// 3. Launcher icons.
// ---------------------------------------------------------------------------
const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const ADAPTIVE = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const [density, size] of Object.entries(LEGACY)) {
  const dir = join(RES, `mipmap-${density}`);
  await sharp(await composeRoundedIcon(size, 0.5)).toFile(join(dir, "ic_launcher.png"));
  await sharp(await composeCircleIcon(size, 0.48)).toFile(join(dir, "ic_launcher_round.png"));
  console.log(`mipmap-${density}: ic_launcher.png + ic_launcher_round.png (${size}px)`);
}

for (const [density, size] of Object.entries(ADAPTIVE)) {
  const dir = join(RES, `mipmap-${density}`);
  // Adaptive foreground sits inside the 66dp safe zone; keep the P at ~50%.
  const pHeight = Math.round(size * 0.5);
  const p = await renderP(pHeight);
  const pWidth = Math.max(1, Math.round(pHeight * pAspect));
  const foreground = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: p, left: Math.round((size - pWidth) / 2), top: Math.round((size - pHeight) / 2) }])
    .png()
    .toBuffer();
  await sharp(foreground).toFile(join(dir, "ic_launcher_foreground.png"));
  console.log(`mipmap-${density}: ic_launcher_foreground.png (${size}px)`);
}

// ---------------------------------------------------------------------------
// 4. Splash screens (dark background + centered brand circle, like the
//    original Capacitor splash layout but with the PinoyBoosting mark).
// ---------------------------------------------------------------------------
const splashTargets = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry === "splash.png") splashTargets.push(full);
  }
};
walk(RES);

for (const file of splashTargets) {
  const meta = await sharp(file).metadata();
  const circle = Math.round(Math.min(meta.width, meta.height) * 0.21875);
  const icon = await composeCircleIcon(circle, 0.46);
  await sharp({
    create: { width: meta.width, height: meta.height, channels: 4, background: SPLASH_BG },
  })
    .composite([{ input: icon, left: Math.round((meta.width - circle) / 2), top: Math.round((meta.height - circle) / 2) }])
    .png()
    .toFile(file);
  console.log(`${file.replace(ROOT + "\\", "")}: ${meta.width}x${meta.height}`);
}

console.log("Done.");
