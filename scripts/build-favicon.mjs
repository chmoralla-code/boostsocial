// scripts/build-favicon.mjs
// Generates a multi-resolution favicon.ico (16, 32, 48) from a solid green "P" mark
// matching the PinoyBoosting brand. Zero deps. Run with: node scripts/build-favicon.mjs
import { writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";

// ---- PNG encoder (truecolor + alpha, no deps) ----
function makePng(size) {
  const w = size, h = size;
  const raw = Buffer.alloc((w * 4 + 1) * h);

  // The P mark: a rounded-square background and a P shape.
  // Coordinates scaled to `size`.
  const bg = [0x22, 0xc5, 0x5e, 0xff]; // green
  const fg = [0xff, 0xff, 0xff, 0xff]; // white
  const radius = Math.round(size * 0.18);
  const stemLeft = Math.round(size * 0.22);
  const stemRight = Math.round(size * 0.36);
  const stemTop = Math.round(size * 0.20);
  const stemBot = Math.round(size * 0.80);
  const bowlTop = Math.round(size * 0.20);
  const bowlBot = Math.round(size * 0.56);
  const bowlRight = Math.round(size * 0.74);

  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter byte
    for (let x = 0; x < w; x++) {
      let color = bg;
      // rounded square mask
      const cx = x < radius ? radius : x > w - radius - 1 ? w - radius - 1 : x;
      const cy = y < radius ? radius : y > h - radius - 1 ? h - radius - 1 : y;
      const dx = x - cx, dy = y - cy;
      const inSquare = dx * dx + dy * dy <= radius * radius;

      if (inSquare) {
        // vertical stem
        if (x >= stemLeft && x < stemRight && y >= stemTop && y < stemBot) {
          color = fg;
        }
        // bowl (rectangle)
        else if (x >= stemRight && x < bowlRight && y >= bowlTop && y < bowlBot) {
          color = fg;
        }
        // inner cutout of bowl
        else if (x >= stemRight + Math.round(size * 0.06) && x < bowlRight - Math.round(size * 0.04) && y >= bowlTop + Math.round(size * 0.06) && y < bowlBot - Math.round(size * 0.06)) {
          color = bg;
        }
      } else {
        color = [0, 0, 0, 0]; // transparent outside the rounded square
      }

      const off = y * (w * 4 + 1) + 1 + x * 4;
      raw[off] = color[0];
      raw[off + 1] = color[1];
      raw[off + 2] = color[2];
      raw[off + 3] = color[3];
    }
  }

  const idatData = deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- ICO container (PNG-encoded entries, supported by all modern browsers) ----
function makeIco(sizes) {
  const images = sizes.map((s) => ({ size: s, png: makePng(s) }));
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + entrySize * images.length;
  let offset = dirSize;
  const entries = [];
  for (const { size, png } of images) {
    const e = Buffer.alloc(entrySize);
    e[0] = size === 256 ? 0 : size; // width
    e[1] = size === 256 ? 0 : size; // height
    e[2] = 0; // colors
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4);   // planes
    e.writeUInt16LE(32, 6);  // bpp
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type=ICO
  header.writeUInt16LE(images.length, 4);
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const ico = makeIco([16, 32, 48]);
writeFileSync("src/app/favicon.ico", ico);
console.log(`favicon.ico written: ${ico.length} bytes`);

// Also overwrite src/app/icon.png with a clean 512x512 brand mark
const big = makePng(512);
writeFileSync("src/app/icon.png", big);
console.log(`icon.png written: ${big.length} bytes`);

const apple = makePng(180);
writeFileSync("src/app/apple-icon.png", apple);
console.log(`apple-icon.png written: ${apple.length} bytes`);

// Also drop a 192 and 512 maskable icon to public/ for PWA / manifest compatibility
const i192 = makePng(192);
writeFileSync("public/icon-192.png", i192);
console.log(`public/icon-192.png written: ${i192.length} bytes`);

const i512 = makePng(512);
writeFileSync("public/icon-512.png", i512);
console.log(`public/icon-512.png written: ${i512.length} bytes`);
