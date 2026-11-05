/**
 * Snapshots documentales inmutables. Al enviar una cotización o emitir un recibo se
 * congelan emisor, cliente, líneas, impuestos, totales y configuración visual. Los PDFs
 * de documentos emitidos se generan SIEMPRE desde el snapshot, por lo que cambios
 * posteriores de marca, logo, tasa o colores no alteran documentos históricos.
 */
import { applyRetentions, computeLine, sumLines, type DocumentTotals, type DiscountType, type RetentionRates, type TaxMode } from "@/lib/money";
import type { FontFamily, PaperSize, PdfTemplate } from "@/features/brands/constants";
import type { CustomFieldType } from "@/features/custom-fields/service";
import type { QuoteStatus } from "@/features/quotes/status";

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const TEMPLATE_VERSION = 1;

export interface BrandSnapshot {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  contactName: string | null;
  logoFileId: string | null;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorText: string;
  fontFamily: FontFamily;
  headerText: string | null;
  footerText: string | null;
  commercialMessage: string | null;
  signatureName: string | null;
  signatureTitle: string | null;
  bank: { name: string | null; beneficiary: string | null; account: string | null; instructions: string | null } | null;
}

export interface PartySnapshot {
  name: string;
  businessName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  address: string | null;
}

export interface QuoteLineSnapshot {
  description: string;
  unit: string | null;
  quantity: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  taxMode: TaxMode;
  taxRate: string;
  hideUnitPrice: boolean;
  grossMinor: number;
  discountMinor: number;
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
  /** Importe mostrado en la columna "Importe" = bruto − descuento. */
  amountMinor: number;
}

export interface QuoteSectionSnapshot {
  title: string | null;
  showSubtotal: boolean;
  subtotalMinor: number;
  items: QuoteLineSnapshot[];
}

export interface QuoteDocumentSnapshot {
  kind: "quote";
  schemaVersion: number;
  templateVersion: number;
  template: PdfTemplate;
  paperSize: PaperSize;
  folio: string | null;
  versionNumber: number;
  status: QuoteStatus;
  issueDate: string | null;
  validUntil: string | null;
  currency: string;
  title: string | null;
  serviceDescription: string | null;
  location: string | null;
  duration: string | null;
  responsible: string | null;
  paymentTerms: string | null;
  validityTerms: string | null;
  publicNotes: string | null;
  showUnitPrices: boolean;
  showOnlyGrandTotal: boolean;
  brand: BrandSnapshot;
  client: PartySnapshot | null;
  sections: QuoteSectionSnapshot[];
  customFields: Array<{ label: string; type: CustomFieldType; value: string | number | boolean }>;
  totals: DocumentTotals;
  frozenAt: string | null;
}

export interface ReceiptDocumentSnapshot {
  kind: "receipt";
  schemaVersion: number;
  templateVersion: number;
  template: PdfTemplate;
  paperSize: PaperSize;
  folio: string;
  status: "ISSUED" | "VOID";
  receivedAt: string;
  timezone: string;
  payer: PartySnapshot;
  concept: string;
  paymentMethod: string;
  paymentReference: string | null;
  currency: string;
  amountMinor: number;
  netMinor: number;
  taxMinor: number;
  taxTreatment: "NONE" | "INCLUDED" | "ADDED";
  taxRate: string;
  notesPublic: string | null;
  signatureName: string | null;
  quote: { folio: string | null; versionNumber: number; title: string | null; totalMinor: number } | null;
  balanceAfter: { paidMinor: number; balanceMinor: number } | null;
  brand: BrandSnapshot;
  voidReason?: string | null;
}

type BrandRow = {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  contactName: string | null;
  logoFileId: string | null;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorText: string;
  fontFamily: string;
  headerText: string | null;
  footerText: string | null;
  commercialMessage: string | null;
  signatureName: string | null;
  signatureTitle: string | null;
  bankName: string | null;
  bankBeneficiary: string | null;
  bankAccount: string | null;
  bankInstructions: string | null;
  showBankDetails: boolean;
};

export function brandSnapshot(b: BrandRow): BrandSnapshot {
  return {
    id: b.id,
    name: b.name,
    legalName: b.legalName,
    taxId: b.taxId,
    email: b.email,
    phone: b.phone,
    website: b.website,
    address: b.address,
    contactName: b.contactName,
    logoFileId: b.logoFileId,
    colorPrimary: b.colorPrimary,
    colorSecondary: b.colorSecondary,
    colorAccent: b.colorAccent,
    colorText: b.colorText,
    fontFamily: b.fontFamily as FontFamily,
    headerText: b.headerText,
    footerText: b.footerText,
    commercialMessage: b.commercialMessage,
    signatureName: b.signatureName,
    signatureTitle: b.signatureTitle,
    bank:
      b.showBankDetails && (b.bankName || b.bankAccount || b.bankBeneficiary || b.bankInstructions)
        ? { name: b.bankName, beneficiary: b.bankBeneficiary, account: b.bankAccount, instructions: b.bankInstructions }
        : null,
  };
}

export function partySnapshot(c: {
  name: string;
  businessName?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  address?: string | null;
}): PartySnapshot {
  return {
    name: c.name,
    businessName: c.businessName ?? null,
    taxId: c.taxId ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    contactName: c.contactName ?? null,
    address: c.address ?? null,
  };
}

export interface LineSource {
  groupId: string | null;
  description: string;
  unit: string | null;
  quantity: string;
  unitPrice: string;
  discountType: string;
  discountValue: string;
  taxMode: string;
  taxRate: string;
  hideUnitPriceInPdf: boolean;
}

/**
 * Calcula líneas y secciones con el motor de dinero (fuente de verdad única).
 * Las líneas sin sección se agrupan al inicio en una sección sin título.
 * Las retenciones (si las hay) se aplican al final sobre los totales del documento.
 */
export function buildSections(
  groups: Array<{ id: string; title: string; showSubtotal: boolean }>,
  items: LineSource[],
  retentions?: RetentionRates,
): { sections: QuoteSectionSnapshot[]; totals: DocumentTotals } {
  const lines = items.map((it) => {
    const r = computeLine({
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountType: it.discountType as DiscountType,
      discountValue: it.discountValue,
      taxMode: it.taxMode as TaxMode,
      taxRate: it.taxRate,
    });
    const line: QuoteLineSnapshot = {
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountType: it.discountType as DiscountType,
      discountValue: it.discountValue,
      taxMode: it.taxMode as TaxMode,
      taxRate: it.taxRate,
      hideUnitPrice: it.hideUnitPriceInPdf,
      ...r,
      amountMinor: r.grossMinor - r.discountMinor,
    };
    return { groupId: it.groupId, line };
  });
  const totals = applyRetentions(sumLines(lines.map((l) => ({ ...l.line }))), retentions);
  const groupIds = new Set(groups.map((g) => g.id));
  const sections: QuoteSectionSnapshot[] = [];
  const ungrouped = lines.filter((l) => !l.groupId || !groupIds.has(l.groupId)).map((l) => l.line);
  if (ungrouped.length) {
    sections.push({
      title: null,
      showSubtotal: false,
      items: ungrouped,
      subtotalMinor: ungrouped.reduce((s, l) => s + l.amountMinor, 0),
    });
  }
  for (const g of groups) {
    const its = lines.filter((l) => l.groupId === g.id).map((l) => l.line);
    sections.push({
      title: g.title || "Sección",
      showSubtotal: g.showSubtotal,
      items: its,
      subtotalMinor: its.reduce((s, l) => s + l.amountMinor, 0),
    });
  }
  return { sections, totals };
}
