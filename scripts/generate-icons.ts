/** Genera los iconos PWA originales y neutros (documento con líneas) a partir de un SVG propio. */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

function svg(size: number, padding: number, rounded: boolean) {
  const s = size;
  const p = padding;
  const w = s - p * 2;
  const r = rounded ? s * 0.22 : 0;
  const docW = w * 0.56;
  const docH = w * 0.7;
  const x = (s - docW) / 2;
  const y = (s - docH) / 2;
  const line = (i: number, len: number) =>
    `<rect x="${x + docW * 0.16}" y="${y + docH * (0.24 + i * 0.15)}" width="${docW * len}" height="${docH * 0.055}" rx="${docH * 0.03}" fill="#F5F2EB"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${r}" fill="#1C1C1B"/>
  <rect x="${x}" y="${y}" width="${docW}" height="${docH}" rx="${docW * 0.1}" fill="none" stroke="#F5F2EB" stroke-width="${s * 0.035}"/>
  ${line(0, 0.68)}${line(1, 0.5)}${line(2, 0.6)}
  <circle cx="${x + docW * 0.78}" cy="${y + docH * 0.86}" r="${docW * 0.2}" fill="#2F5DCC" stroke="#1C1C1B" stroke-width="${s * 0.02}"/>
</svg>`;
}

async function main() {
  await mkdir("public/icons", { recursive: true });
  const jobs: Array<[string, number, number, boolean]> = [
    ["icon-192.png", 192, 8, true],
    ["icon-512.png", 512, 20, true],
    ["icon-maskable-512.png", 512, 90, false],
    ["apple-touch-icon.png", 180, 10, false],
  ];
  for (const [name, size, pad, rounded] of jobs) {
    await sharp(Buffer.from(svg(size, pad, rounded))).png().toFile(`public/icons/${name}`);
  }
  await sharp(Buffer.from(svg(64, 2, true))).resize(32, 32).png().toFile("public/icons/favicon-32.png");
  console.log("✔ Iconos generados en public/icons");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
