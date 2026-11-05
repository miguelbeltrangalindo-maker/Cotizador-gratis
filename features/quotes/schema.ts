import { z } from "zod";
import { CURRENCIES, DISCOUNT_TYPES, TAX_MODES } from "@/lib/money";
import { PAPER_SIZES, PDF_TEMPLATES } from "@/features/brands/constants";

export const MAX_ITEMS = 500;
export const MAX_GROUPS = 50;

const text = (max: number) => z.string().max(max, `Máximo ${max} caracteres`).default("");
const num = z.union([z.string(), z.number()]).transform((v) => String(v).trim().replace(/,/g, ""));

export const draftItemSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid().nullable().default(null),
  description: text(20000),
  unit: z.string().max(40).nullable().default(null),
  quantity: num,
  unitPrice: num,
  discountType: z.enum(DISCOUNT_TYPES).default("NONE"),
  discountValue: num.default("0"),
  taxMode: z.enum(TAX_MODES).default("NONE"),
  taxRate: num.default("0"),
  hideUnitPriceInPdf: z.boolean().default(false),
});

export const draftGroupSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(200).default(""),
  showSubtotal: z.boolean().default(true),
});

export const draftSchema = z.object({
  brandId: z.string().uuid(),
  clientId: z.string().uuid().nullable().default(null),
  title: text(500),
  serviceDescription: text(20000),
  location: text(500),
  duration: text(200),
  responsible: text(200),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  currency: z.enum(CURRENCIES),
  paymentTerms: text(5000),
  validityTerms: text(2000),
  publicNotes: text(10000),
  internalNotes: text(10000),
  showUnitPrices: z.boolean().default(true),
  showOnlyGrandTotal: z.boolean().default(false),
  pdfTemplate: z.enum(PDF_TEMPLATES).nullable().default(null),
  paperSize: z.enum(PAPER_SIZES).nullable().default(null),
  /** Retenciones del documento en %, p. ej. RESICO: IVA "10.6667" e ISR "1.25". */
  retentionIvaRate: num.default("0"),
  retentionIsrRate: num.default("0"),
  groups: z.array(draftGroupSchema).max(MAX_GROUPS, `Máximo ${MAX_GROUPS} secciones`).default([]),
  items: z.array(draftItemSchema).max(MAX_ITEMS, `Máximo ${MAX_ITEMS} conceptos por versión`).default([]),
  customValues: z
    .record(z.string().max(60), z.union([z.string().max(5000), z.number(), z.boolean(), z.null()]))
    .default({}),
});

export type DraftInput = z.input<typeof draftSchema>;
export type DraftData = z.output<typeof draftSchema>;
export type DraftItem = z.output<typeof draftItemSchema>;
export type DraftGroup = z.output<typeof draftGroupSchema>;
