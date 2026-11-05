import path from "node:path";
import { Font } from "@react-pdf/renderer";
import { ensureContrast, readableTextOn, tint } from "@/lib/utils/color";
import type { FontFamily, PaperSize, PdfTemplate } from "@/features/brands/constants";
import type { BrandSnapshot } from "@/features/documents/snapshot";

let registered = false;

/** Registra tipografías OFL incrustadas (assets/fonts). Helvetica es estándar PDF. */
export function registerFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "inter-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(dir, "inter-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(dir, "inter-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Lora",
    fonts: [
      { src: path.join(dir, "lora-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(dir, "lora-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  // Evita cortes de palabra con guiones extraños: se parte por espacios y, si no cabe, por carácter.
  Font.registerHyphenationCallback((word) => (word.length > 24 ? word.match(/.{1,12}/g) ?? [word] : [word]));
  registered = true;
}

export function fontFamilyName(f: FontFamily): { regular: string; bold: string; boldWeight: number } {
  if (f === "LORA") return { regular: "Lora", bold: "Lora", boldWeight: 700 };
  if (f === "HELVETICA") return { regular: "Helvetica", bold: "Helvetica-Bold", boldWeight: 700 };
  return { regular: "Inter", bold: "Inter", boldWeight: 700 };
}

export interface PdfTheme {
  template: PdfTemplate;
  page: "LETTER" | "A4";
  font: string;
  fontBold: string;
  boldWeight: number;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  /** Primario legible sobre blanco (para títulos/acentos de texto). */
  primaryText: string;
  accentText: string;
  soft: string;
}

export function buildTheme(brand: BrandSnapshot, template: PdfTemplate, paper: PaperSize): PdfTheme {
  const f = fontFamilyName(brand.fontFamily);
  return {
    template,
    page: paper === "A4" ? "A4" : "LETTER",
    font: f.regular,
    fontBold: f.bold,
    boldWeight: f.boldWeight,
    text: ensureContrast(brand.colorText, "#FFFFFF", 7),
    muted: "#5F5F5A",
    border: "#E2DED5",
    primary: brand.colorPrimary,
    onPrimary: readableTextOn(brand.colorPrimary),
    primaryText: ensureContrast(brand.colorPrimary, "#FFFFFF", 4.5),
    accentText: ensureContrast(brand.colorAccent, "#FFFFFF", 4.5),
    soft: tint(brand.colorPrimary, 0.92),
  };
}
