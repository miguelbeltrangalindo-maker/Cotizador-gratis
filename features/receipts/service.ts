import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { organizations, quoteItems, quoteVersions, quotes, receipts } from "@/lib/db/schema";
import type { Tx } from "@/lib/db";
import { AppError, conflict, notFound, validation } from "@/lib/errors";
import {
  computeReceiptAmounts,
  CURRENCIES,
  formatMoney,
  MoneyError,
  parseAmountToMinor,
  RECEIPT_TAX_TREATMENTS,
} from "@/lib/money";
import { assertCan, assertUuid, withTenant, type TenantContext } from "@/lib/security/tenant";
import { yearInTimeZone } from "@/lib/utils/dates";
import { optionalText, parseInput } from "@/lib/validation";
import { audit } from "@/features/audit/service";
import { getBrandTx } from "@/features/brands/service";
import type { PaperSize, PdfTemplate } from "@/features/brands/constants";
import { getClientTx, likePattern } from "@/features/clients/service";
import {
  brandSnapshot,
  partySnapshot,
  SNAPSHOT_SCHEMA_VERSION,
  TEMPLATE_VERSION,
  type ReceiptDocumentSnapshot,
} from "@/features/documents/snapshot";
import { getQuoteBalanceTx } from "@/features/quotes/service";
import { generateNextFolio } from "@/features/quotes/sequence";

import { PAYMENT_METHODS } from "./constants";
export * from "./constants";

export const receiptSchema = z.object({
  idempotencyKey: z.string().uuid("Clave de operación inválida"),
  brandId: z.string().uuid("Selecciona una marca"),
  quoteId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  clientId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  payerName: z.string().trim().min(1, "Escribe quién realiza el pago").max(250),
  concept: z.string().trim().min(1, "Escribe el concepto del pago").max(2000),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentReference: optionalText(200),
  receivedAt: z.coerce.date({ message: "Fecha de recepción inválida" }),
  currency: z.enum(CURRENCIES),
  amount: z.union([z.string(), z.number()]),
  taxTreatment: z.enum(RECEIPT_TAX_TREATMENTS).default("NONE"),
  taxRate: z.union([z.string(), z.number()]).default("16"),
  notesPublic: optionalText(4000),
  notesInternal: optionalText(4000),
  signatureName: optionalText(160),
});
export type ReceiptInput = z.input<typeof receiptSchema>;
export type Receipt = typeof receipts.$inferSelect;

/** Problemas que impiden emitir (para deshabilitar el botón y explicar qué falta). */
export function receiptIssueProblems(input: Partial<Record<"payerName" | "concept" | "amount" | "brandId", unknown>>) {
  const p: string[] = [];
  if (!String(input.brandId ?? "").trim()) p.push("marca");
  if (!String(input.payerName ?? "").trim()) p.push("pagador");
  if (!String(input.concept ?? "").trim()) p.push("concepto");
  try {
    if (parseAmountToMinor(String(input.amount ?? "")) <= 0) p.push("monto");
  } catch {
    p.push("monto");
  }
  return p;
}

/**
 * Emite un recibo (independiente o vinculado a cotización) en una sola transacción:
 * - Idempotencia: la misma `idempotencyKey` devuelve el recibo ya emitido (doble clic, reintentos).
 * - Bloquea la cotización (SELECT … FOR UPDATE) para serializar pagos simultáneos.
 * - Rechaza monedas distintas y sobrepagos.
 * - Asigna folio único y guarda snapshot inmutable.
 */
export async function issueReceipt(ctx: TenantContext, input: ReceiptInput): Promise<{ receipt: Receipt; duplicated: boolean }> {
  assertCan(ctx, "documents.write");
  const data = parseInput(receiptSchema, input);
  let amounts: ReturnType<typeof computeReceiptAmounts>;
  try {
    const enteredMinor = parseAmountToMinor(data.amount, "Monto");
    if (enteredMinor <= 0) throw validation("El monto debe ser mayor que cero.", { amount: "Debe ser mayor que cero" });
    amounts = computeReceiptAmounts(enteredMinor, data.taxTreatment, data.taxRate);
  } catch (e) {
    if (e instanceof MoneyError) throw validation(e.message, { amount: e.message });
    throw e;
  }

  try {
    return await issueReceiptTx(ctx, data, amounts);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Carrera con la misma clave de idempotencia: devuelve el recibo ganador.
    const winner = await withTenant(ctx, async (tx) => {
      const [r] = await tx
        .select()
        .from(receipts)
        .where(and(eq(receipts.organizationId, ctx.organizationId), eq(receipts.idempotencyKey, data.idempotencyKey)));
      return r;
    });
    if (winner) return { receipt: winner, duplicated: true };
    throw conflict("No fue posible emitir el recibo por una operación simultánea. Inténtalo de nuevo.");
  }
}

async function issueReceiptTx(
  ctx: TenantContext,
  data: z.output<typeof receiptSchema>,
  amounts: ReturnType<typeof computeReceiptAmounts>,
): Promise<{ receipt: Receipt; duplicated: boolean }> {
  return withTenant(ctx, async (tx) => {
    const [existing] = await tx
      .select()
      .from(receipts)
      .where(and(eq(receipts.organizationId, ctx.organizationId), eq(receipts.idempotencyKey, data.idempotencyKey)));
    if (existing) return { receipt: existing, duplicated: true };

    const brand = await getBrandTx(tx, ctx, data.brandId);
    if (!brand.isActive) throw validation("La marca seleccionada está desactivada.");
    const client = data.clientId ? await getClientTx(tx, ctx, data.clientId) : null;

    let quoteRef: ReceiptDocumentSnapshot["quote"] = null;
    let quoteVersionId: string | null = null;
    let balanceAfter: ReceiptDocumentSnapshot["balanceAfter"] = null;
    if (data.quoteId) {
      const [quote] = await tx
        .select()
        .from(quotes)
        .where(and(eq(quotes.id, data.quoteId), eq(quotes.organizationId, ctx.organizationId)))
        .for("update");
      if (!quote) throw notFound("La cotización");
      const { reference, balance } = await getQuoteBalanceTx(tx, ctx, quote.id);
      if (!reference) {
        throw validation("La cotización debe estar enviada o aprobada para registrar pagos.");
      }
      if (reference.currency !== data.currency) {
        throw validation(
          `La cotización está en ${reference.currency} y el recibo en ${data.currency}. No se mezclan monedas sin un tipo de cambio explícito; registra el pago en ${reference.currency}.`,
          { currency: "Moneda distinta a la cotización" },
        );
      }
      if (amounts.amountMinor > balance.balanceMinor) {
        throw validation(
          `El pago excede el saldo pendiente (${formatMoney(balance.balanceMinor, reference.currency)}). No se admiten sobrepagos.`,
          { amount: "Excede el saldo" },
        );
      }
      quoteVersionId = reference.id;
      quoteRef = {
        folio: quote.folio,
        versionNumber: reference.versionNumber,
        title: reference.title,
        totalMinor: reference.totalMinor,
      };
      balanceAfter = {
        paidMinor: balance.paidMinor + amounts.amountMinor,
        balanceMinor: balance.balanceMinor - amounts.amountMinor,
      };
    }

    const [org] = await tx.select().from(organizations).where(eq(organizations.id, ctx.organizationId));
    const timezone = org?.timezone ?? ctx.timezone;
    const year = yearInTimeZone(timezone, data.receivedAt);
    const seq = await generateNextFolio(tx, {
      organizationId: ctx.organizationId,
      prefix: brand.receiptPrefix,
      documentType: "RECEIPT",
      year,
      padding: brand.folioPadding,
    });

    const snapshot: ReceiptDocumentSnapshot = {
      kind: "receipt",
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      templateVersion: TEMPLATE_VERSION,
      template: brand.pdfTemplate as PdfTemplate,
      paperSize: brand.paperSize as PaperSize,
      folio: seq.folio,
      status: "ISSUED",
      receivedAt: data.receivedAt.toISOString(),
      timezone,
      payer: client ? { ...partySnapshot(client), name: data.payerName } : partySnapshot({ name: data.payerName }),
      concept: data.concept,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      currency: data.currency,
      amountMinor: amounts.amountMinor,
      netMinor: amounts.netMinor,
      taxMinor: amounts.taxMinor,
      taxTreatment: data.taxTreatment,
      taxRate: data.taxTreatment === "NONE" ? "0" : String(data.taxRate),
      notesPublic: data.notesPublic,
      signatureName: data.signatureName ?? brand.signatureName,
      quote: quoteRef,
      balanceAfter,
      brand: brandSnapshot(brand),
    };

    {
      const [receipt] = await tx
        .insert(receipts)
        .values({
          organizationId: ctx.organizationId,
          brandId: brand.id,
          clientId: client?.id ?? null,
          quoteId: data.quoteId,
          quoteVersionId,
          receiptNo: seq.number,
          year,
          folio: seq.folio,
          payerName: data.payerName,
          concept: data.concept,
          paymentMethod: data.paymentMethod,
          paymentReference: data.paymentReference,
          receivedAt: data.receivedAt,
          currency: data.currency,
          amountMinor: amounts.amountMinor,
          taxTreatment: data.taxTreatment,
          taxRate: snapshot.taxRate,
          netMinor: amounts.netMinor,
          taxMinor: amounts.taxMinor,
          notesPublic: data.notesPublic,
          notesInternal: data.notesInternal,
          signatureName: snapshot.signatureName,
          idempotencyKey: data.idempotencyKey,
          snapshotJson: snapshot,
          createdBy: ctx.userId,
        })
        .returning();
      await audit(tx, ctx, "receipt.issue", "receipt", receipt.id, {
        folio: receipt.folio,
        linked: Boolean(data.quoteId),
      });
      return { receipt, duplicated: false };
    }
  });
}

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/** Anula un recibo con motivo. Un recibo emitido nunca se edita ni se borra. */
export async function voidReceipt(ctx: TenantContext, receiptId: string, reason: string) {
  assertCan(ctx, "receipts.void");
  assertUuid(receiptId, "El recibo");
  const r = reason?.trim() ?? "";
  if (r.length < 3) throw validation("Escribe el motivo de la anulación.", { reason: "Motivo obligatorio" });
  if (r.length > 500) throw validation("El motivo es demasiado largo.");
  return withTenant(ctx, async (tx) => {
    const [receipt] = await tx
      .select()
      .from(receipts)
      .where(and(eq(receipts.id, receiptId), eq(receipts.organizationId, ctx.organizationId)))
      .for("update");
    if (!receipt) throw notFound("El recibo");
    if (receipt.status === "VOID") throw conflict("El recibo ya estaba anulado.");
    const snap = receipt.snapshotJson as ReceiptDocumentSnapshot;
    await tx
      .update(receipts)
      .set({
        status: "VOID",
        voidReason: r,
        voidedAt: new Date(),
        voidedBy: ctx.userId,
        snapshotJson: { ...snap, status: "VOID", voidReason: r },
      })
      .where(eq(receipts.id, receipt.id));
    await audit(tx, ctx, "receipt.void", "receipt", receipt.id, { folio: receipt.folio });
  });
}

export async function getReceiptTx(tx: Tx, ctx: TenantContext, receiptId: string) {
  assertUuid(receiptId, "El recibo");
  const [r] = await tx
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), eq(receipts.organizationId, ctx.organizationId)));
  if (!r) throw notFound("El recibo");
  return r;
}

export async function getReceipt(ctx: TenantContext, receiptId: string) {
  return withTenant(ctx, async (tx) => {
    const receipt = await getReceiptTx(tx, ctx, receiptId);
    let quote: { id: string; folio: string | null } | null = null;
    if (receipt.quoteId) {
      const [q] = await tx
        .select({ id: quotes.id, folio: quotes.folio })
        .from(quotes)
        .where(and(eq(quotes.id, receipt.quoteId), eq(quotes.organizationId, ctx.organizationId)));
      quote = q ?? null;
    }
    return { receipt, document: receipt.snapshotJson as ReceiptDocumentSnapshot, quote };
  });
}

export async function listReceipts(
  ctx: TenantContext,
  opts: { q?: string; status?: "ISSUED" | "VOID" | "ALL"; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(50, opts.pageSize ?? 20);
  return withTenant(ctx, async (tx) => {
    const conds = [eq(receipts.organizationId, ctx.organizationId)];
    if (opts.status === "ISSUED" || opts.status === "VOID") conds.push(eq(receipts.status, opts.status));
    const q = opts.q?.trim().slice(0, 100);
    if (q) {
      const p = likePattern(q);
      conds.push(
        or(
          ilike(receipts.folio, p),
          ilike(receipts.payerName, p),
          ilike(receipts.concept, p),
          ilike(receipts.paymentReference, p),
          ilike(quotes.folio, p),
        )!,
      );
    }
    const where = and(...conds);
    const [{ total }] = await tx
      .select({ total: count() })
      .from(receipts)
      .leftJoin(quotes, eq(quotes.id, receipts.quoteId))
      .where(where);
    const [{ issued }] = await tx
      .select({ issued: count() })
      .from(receipts)
      .where(and(eq(receipts.organizationId, ctx.organizationId), eq(receipts.status, "ISSUED")));
    const rows = await tx
      .select({
        id: receipts.id,
        folio: receipts.folio,
        payerName: receipts.payerName,
        concept: receipts.concept,
        amountMinor: receipts.amountMinor,
        currency: receipts.currency,
        paymentMethod: receipts.paymentMethod,
        paymentReference: receipts.paymentReference,
        receivedAt: receipts.receivedAt,
        status: receipts.status,
        quoteFolio: quotes.folio,
        quoteId: receipts.quoteId,
      })
      .from(receipts)
      .leftJoin(quotes, eq(quotes.id, receipts.quoteId))
      .where(where)
      .orderBy(desc(receipts.receivedAt), desc(receipts.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { rows, total, issued, page, pageSize };
  });
}

/** Datos para precargar un recibo desde una cotización. */
export async function getReceiptPrefillFromQuote(ctx: TenantContext, quoteId: string) {
  return withTenant(ctx, async (tx) => {
    assertUuid(quoteId, "La cotización");
    const [quote] = await tx
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, ctx.organizationId)));
    if (!quote) throw notFound("La cotización");
    const { reference, balance } = await getQuoteBalanceTx(tx, ctx, quote.id);
    if (!reference) throw new AppError("VALIDATION_ERROR", "La cotización debe estar enviada o aprobada para registrar pagos.");
    const client = quote.clientId ? await getClientTx(tx, ctx, quote.clientId) : null;
    const [v] = await tx.select().from(quoteVersions).where(eq(quoteVersions.id, reference.id));
    const lines = await tx
      .select({ taxMode: quoteItems.taxMode, taxRate: quoteItems.taxRate })
      .from(quoteItems)
      .where(and(eq(quoteItems.quoteVersionId, reference.id), eq(quoteItems.organizationId, ctx.organizationId)));
    const tax = suggestReceiptTax(lines, v?.retentionMinor ?? 0);
    return {
      quoteId: quote.id,
      folio: quote.folio,
      brandId: quote.brandId,
      clientId: client?.id ?? null,
      payerName: client?.name ?? "",
      currency: reference.currency,
      concept: `${balance.paidMinor > 0 ? "Pago parcial" : "Anticipo"} de cotización ${quote.folio}${v?.title ? ` — ${v.title}` : ""}`,
      balanceMinor: balance.balanceMinor,
      paidMinor: balance.paidMinor,
      totalMinor: reference.totalMinor,
      versionNumber: reference.versionNumber,
      suggestedTaxTreatment: tax.treatment,
      suggestedTaxRate: tax.rate,
      taxNote: tax.note,
    };
  });
}

/**
 * IVA informativo sugerido para un recibo vinculado. Solo se propone "Incluye IVA" cuando
 * todos los conceptos llevan IVA a la misma tasa y no hay retenciones; en otro caso el
 * desglose automático sería incorrecto y se deja en "Sin IVA" con una nota.
 */
export function suggestReceiptTax(
  lines: Array<{ taxMode: string; taxRate: string }>,
  retentionMinor: number,
): { treatment: "NONE" | "INCLUDED"; rate: string; note: string | null } {
  if (lines.length === 0 || lines.every((l) => l.taxMode === "NONE")) {
    return { treatment: "NONE", rate: "16", note: null };
  }
  if (retentionMinor > 0) {
    return {
      treatment: "NONE",
      rate: "16",
      note: "La cotización tiene retenciones: el pago es el neto y el IVA no se desglosa automáticamente.",
    };
  }
  const rates = new Set(lines.map((l) => (l.taxMode === "NONE" ? "NONE" : String(Number(l.taxRate)))));
  if (rates.size === 1 && !rates.has("NONE")) {
    return { treatment: "INCLUDED", rate: [...rates][0], note: null };
  }
  return {
    treatment: "NONE",
    rate: "16",
    note: "La cotización combina conceptos con distinto IVA: el IVA no se desglosa automáticamente.",
  };
}
