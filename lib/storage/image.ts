/**
 * Validación y normalización segura de imágenes (logos).
 * - Detecta el tipo REAL por contenido (sharp), no por extensión ni MIME declarado.
 * - Admite PNG, JPEG y WebP. SVG se RASTERIZA a PNG (librsvg no ejecuta scripts); nunca se
 *   sirve el SVG original.
 * - Reescala a un máximo de 1200 px y elimina metadatos (EXIF, etc.).
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { validation } from "@/lib/errors";

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;

export interface NormalizedImage {
  data: Buffer;
  mimeType: "image/png" | "image/jpeg";
  ext: "png" | "jpg";
  width: number;
  height: number;
  checksum: string;
}

export async function normalizeLogo(input: Buffer): Promise<NormalizedImage> {
  if (input.length === 0) throw validation("El archivo está vacío.");
  if (input.length > MAX_LOGO_BYTES) throw validation("El logo debe pesar como máximo 5 MB.");
  const head = input.subarray(0, 512).toString("utf8").toLowerCase();
  const looksSvg = head.includes("<svg") || head.includes("<?xml");
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw validation("No pudimos leer la imagen. Usa PNG, JPG, WebP o SVG.");
  }
  const allowed = ["png", "jpeg", "webp", "svg"];
  if (!meta.format || !allowed.includes(meta.format) || (looksSvg && meta.format !== "svg")) {
    throw validation("Formato no permitido. Usa PNG, JPG, WebP o SVG.");
  }
  if (!meta.width || !meta.height || meta.width < 16 || meta.height < 16) {
    throw validation("La imagen es demasiado pequeña (mínimo 16×16 px).");
  }
  const keepAlpha = meta.format === "png" || meta.format === "webp" || meta.format === "svg" || meta.hasAlpha;
  let pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, density: meta.format === "svg" ? 300 : undefined })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: meta.format !== "svg" });
  pipeline = keepAlpha ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 88, mozjpeg: true });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    data,
    mimeType: keepAlpha ? "image/png" : "image/jpeg",
    ext: keepAlpha ? "png" : "jpg",
    width: info.width,
    height: info.height,
    checksum: createHash("sha256").update(data).digest("hex"),
  };
}
