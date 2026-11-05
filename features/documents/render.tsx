import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { readFile, getBrand } from "@/features/brands/service";
import type { PaperSize, PdfTemplate } from "@/features/brands/constants";
import { getQuoteDocument } from "@/features/quotes/service";
import { getReceipt } from "@/features/receipts/service";
import type { TenantContext } from "@/lib/security/tenant";
import { quotePdfFilename, receiptPdfFilename } from "@/lib/utils/text";
import { todayInTimeZone, addDays } from "@/lib/utils/dates";
import { computeReceiptAmounts } from "@/lib/money";
import type { LogoData } from "./pdf/common";
import { QuotePdf } from "./pdf/quote-document";
import { ReceiptPdf } from "./pdf/receipt-document";
import { registerFonts } from "./pdf/theme";
import {
  brandSnapshot,
  buildSections,
  SNAPSHOT_SCHEMA_VERSION,
  TEMPLATE_VERSION,
  type QuoteDocumentSnapshot,
  type ReceiptDocumentSnapshot,
} from "./snapshot";

/** Carga el logo del documento verificando que pertenece a la organización. */
async function loadLogo(ctx: TenantContext, fileId: string | null): Promise<LogoData | null> {
  if (!fileId) return null;
  try {
    const { file, data } = await readFile(ctx, fileId);
    return { data, width: file.width ?? 200, height: file.height ?? 80, format: file.mimeType === "image/png" ? "png" : "jpg" };
  } catch {
    return null;
  }
}

export async function renderQuotePdf(ctx: TenantContext, quoteId: string, versionNumber?: number) {
  registerFonts();
  const { document, quote, version } = await getQuoteDocument(ctx, quoteId, versionNumber);
  const logo = await loadLogo(ctx, document.brand.logoFileId);
  const buffer = await renderToBuffer(<QuotePdf doc={document} logo={logo} />);
  return { buffer, filename: quotePdfFilename(quote.folio, document.client?.name ?? null, version.versionNumber) };
}

export async function renderReceiptPdf(ctx: TenantContext, receiptId: string) {
  registerFonts();
  const { document } = await getReceipt(ctx, receiptId);
  const logo = await loadLogo(ctx, document.brand.logoFileId);
  const buffer = await renderToBuffer(<ReceiptPdf doc={document} logo={logo} />);
  return { buffer, filename: receiptPdfFilename(document.folio, document.payer.name) };
}

/** Vista previa con datos de ejemplo para el configurador de marca y plantillas. */
export async function renderBrandSamplePdf(
  ctx: TenantContext,
  brandId: string,
  kind: "quote" | "receipt",
  template?: PdfTemplate,
  paper?: PaperSize,
) {
  registerFonts();
  const brand = await getBrand(ctx, brandId);
  const b = brandSnapshot(brand);
  const tpl = (template ?? brand.pdfTemplate) as PdfTemplate;
  const pp = (paper ?? brand.paperSize) as PaperSize;
  const logo = await loadLogo(ctx, brand.logoFileId);
  const today = todayInTimeZone(ctx.timezone);
  if (kind === "receipt") {
    const amounts = computeReceiptAmounts(150000, "NONE", 0);
    const doc: ReceiptDocumentSnapshot = {
      kind: "receipt",
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      templateVersion: TEMPLATE_VERSION,
      template: tpl,
      paperSize: pp,
      folio: `${brand.receiptPrefix}-${today.slice(0, 4)}-${"1".padStart(brand.folioPadding, "0")}`,
      status: "ISSUED",
      receivedAt: new Date().toISOString(),
      timezone: ctx.timezone,
      payer: { name: "Cliente de ejemplo", businessName: null, taxId: null, email: null, phone: null, contactName: null, address: null },
      concept: "Anticipo del 50 % — EJEMPLO (vista previa)",
      paymentMethod: "TRANSFER",
      paymentReference: "SPEI 123456",
      currency: brand.defaultCurrency,
      ...amounts,
      taxTreatment: "NONE",
      taxRate: "0",
      notesPublic: "Gracias por su pago.",
      signatureName: brand.signatureName,
      quote: null,
      balanceAfter: null,
      brand: b,
    };
    return { buffer: await renderToBuffer(<ReceiptPdf doc={doc} logo={logo} />), filename: "Vista_previa_recibo.pdf" };
  }
  const taxMode = brand.defaultTaxMode;
  const rate = taxMode === "NONE" ? "0" : brand.defaultTaxRate;
  const { sections, totals } = buildSections(
    [{ id: "g1", title: "Producción", showSubtotal: true }],
    [
      { groupId: null, description: "Sesión fotográfica de producto (EJEMPLO)\nIncluye edición básica de 30 imágenes.", unit: "jornada", quantity: "3", unitPrice: "300", discountType: "NONE", discountValue: "0", taxMode, taxRate: rate, hideUnitPriceInPdf: false },
      { groupId: "g1", description: "Video promocional de 60 segundos (EJEMPLO)", unit: "pieza", quantity: "2", unitPrice: "350", discountType: "NONE", discountValue: "0", taxMode, taxRate: rate, hideUnitPriceInPdf: false },
    ],
  );
  const doc: QuoteDocumentSnapshot = {
    kind: "quote",
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    templateVersion: TEMPLATE_VERSION,
    template: tpl,
    paperSize: pp,
    folio: `${brand.quotePrefix}-${today.slice(0, 4)}-${"1".padStart(brand.folioPadding, "0")}`,
    versionNumber: 1,
    status: "SENT",
    issueDate: today,
    validUntil: addDays(today, brand.defaultValidityDays || 15),
    currency: brand.defaultCurrency,
    title: "Proyecto de ejemplo — vista previa de marca",
    serviceDescription: "Este documento usa datos de ejemplo para mostrar tu logo, colores y estilo.",
    location: "Ciudad de México",
    duration: "2 semanas",
    responsible: null,
    paymentTerms: brand.defaultPaymentTerms ?? "50 % de anticipo y 50 % contra entrega.",
    validityTerms: null,
    publicNotes: null,
    showUnitPrices: true,
    showOnlyGrandTotal: false,
    brand: b,
    client: { name: "Cliente de ejemplo", businessName: "Empresa Ejemplo S.A. de C.V.", taxId: null, email: "cliente@ejemplo.com", phone: null, contactName: null, address: null },
    sections,
    customFields: [],
    totals,
    frozenAt: null,
  };
  return { buffer: await renderToBuffer(<QuotePdf doc={doc} logo={logo} />), filename: "Vista_previa_cotizacion.pdf" };
}
