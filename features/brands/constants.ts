/** Constantes de marca seguras para cliente y servidor. */
export const PDF_TEMPLATES = ["MINIMAL", "CORPORATE", "CREATIVE"] as const;
export type PdfTemplate = (typeof PDF_TEMPLATES)[number];
export const PDF_TEMPLATE_LABEL: Record<PdfTemplate, string> = {
  MINIMAL: "Minimal",
  CORPORATE: "Corporativo",
  CREATIVE: "Creativo",
};
export const PAPER_SIZES = ["LETTER", "A4"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];
export const FONT_FAMILIES = ["INTER", "LORA", "HELVETICA"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
export const FONT_LABEL: Record<FontFamily, string> = {
  INTER: "Inter (sans serif moderna)",
  LORA: "Lora (serif elegante)",
  HELVETICA: "Helvetica (clásica)",
};

export const DEFAULT_BRAND_STYLE = {
  colorPrimary: "#1C1C1B",
  colorSecondary: "#777772",
  colorAccent: "#2F5DCC",
  colorText: "#1C1C1B",
  fontFamily: "INTER" as FontFamily,
  pdfTemplate: "MINIMAL" as PdfTemplate,
};

