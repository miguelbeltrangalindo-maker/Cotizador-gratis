import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import {
  brands,
  clients,
  organizations,
  quoteCustomValues,
  quoteGroups,
  quoteItems,
  quoteVersions,
  quotes,
  receipts,
} from "@/lib/db/schema";
import type { Tx } from "@/lib/db";
import { AppError, conflict, notFound, validation } from "@/lib/errors";
import { calculatePaidAndBalance, computeLine, MoneyError, normalizeLine, type BalanceResult } from "@/lib/money";
import { assertCan, assertUuid, withTenant, type TenantContext } from "@/lib/security/tenant";
import { addDays, todayInTimeZone, yearInTimeZone } from "@/lib/utils/dates";
import { parseInput } from "@/lib/validation";
import { audit } from "@/features/audit/service";
import { getBrandTx } from "@/features/brands/service";
import type { PaperSize, PdfTemplate } from "@/features/brands/constants";
import { getClientTx, likePattern } from "@/features/clients/service";
import {
  listCustomFieldsTx,
  normalizeCustomValue,
  toDefinitionSnapshot,
  type CustomFieldDefinitionSnapshot,
} from "@/features/custom-fields/service";
import {
  brandSnapshot,
  buildSections,
  partySnapshot,
  SNAPSHOT_SCHEMA_VERSION,
  TEMPLATE_VERSION,
  type QuoteDocumentSnapshot,
} from "@/features/documents/snapshot";
import { draftSchema, type DraftData, type DraftInput } from "./schema";
import { canTransition, QUOTE_STATUS_LABEL, type QuoteStatus } from "./status";
import { generateNextFolio } from "./sequence";

type VersionRow = typeof quoteVersions.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

async function getQuoteRowTx(tx: Tx, ctx: TenantContext, quoteId: string, forUpdate = false): Promise<QuoteRow> {
  assertUuid(quoteId, "La cotización");
  const q = tx
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, ctx.organizationId)));
  const [row] = forUpdate ? await q.for("update") : await q;
  if (!row) throw notFound("La cotización");
  return row;
}

async function getVersionsTx(tx: Tx, ctx: TenantContext, quoteId: string) {
  return tx
    .select()
    .from(quoteVersions)
    .where(and(eq(quoteVersions.quoteId, quoteId), eq(quoteVersions.organizationId, ctx.organizationId)))
    .orderBy(asc(quoteVersions.versionNumber));
}

async function getVersionContentTx(tx: Tx, ctx: TenantContext, versionId: string) {
  const [groups, items, custom] = await Promise.all([
    tx
      .select()
      .from(quoteGroups)
      .where(and(eq(quoteGroups.quoteVersionId, versionId), eq(quoteGroups.organizationId, ctx.organizationId)))
      .orderBy(asc(quoteGroups.position)),
    tx
      .select()
      .from(quoteItems)
      .where(and(eq(quoteItems.quoteVersionId, versionId), eq(quoteItems.organizationId, ctx.organizationId)))
      .orderBy(asc(quoteItems.position)),
    tx
      .select()
      .from(quoteCustomValues)
      .where(
        and(eq(quoteCustomValues.quoteVersionId, versionId), eq(quoteCustomValues.organizationId, ctx.organizationId)),
      ),
  ]);
  return { groups, items, custom };
}

/**
 * Versión de referencia para el saldo: la aprobada más reciente; si no hay, la enviada más
 * reciente. Borradores, rechazadas y vencidas sin aprobación no generan saldo exigible.
 */
export function pickReferenceVersion<T extends { status: string; versionNumber: number }>(versions: T[]): T | null {
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  return sorted.find((v) => v.status === "APPROVED") ?? sorted.find((v) => v.status === "SENT") ?? null;
}

export async function getQuoteBalanceTx(tx: Tx, ctx: TenantContext, quoteId: string, versions?: VersionRow[]) {
  const vs = versions ?? (await getVersionsTx(tx, ctx, quoteId));
  const ref = pickReferenceVersion(vs);
  const rs = await tx
    .select({ amountMinor: receipts.amountMinor, status: receipts.status })
    .from(receipts)
    .where(and(eq(receipts.quoteId, quoteId), eq(receipts.organizationId, ctx.organizationId)));
  const balance = calculatePaidAndBalance({
    baseTotalMinor: ref ? ref.totalMinor : null,
    receipts: rs.map((r) => ({ amountMinor: r.amountMinor, status: r.status as "ISSUED" | "VOID" })),
  });
  return { reference: ref, balance, hasReceipts: rs.length > 0 };
}

export interface QuoteDetail {
  quote: QuoteRow;
  versions: VersionRow[];
  version: VersionRow;
  isCurrent: boolean;
  content: Awaited<ReturnType<typeof getVersionContentTx>>;
  brand: typeof brands.$inferSelect;
  client: typeof clients.$inferSelect | null;
  document: QuoteDocumentSnapshot;
  balance: BalanceResult;
  referenceVersionNumber: number | null;
  receipts: Array<typeof receipts.$inferSelect>;
}

export async function getQuoteDetail(ctx: TenantContext, quoteId: string, versionNumber?: number): Promise<QuoteDetail> {
  return withTenant(ctx, async (tx) => {
    const quote = await getQuoteRowTx(tx, ctx, quoteId);
    const versions = await getVersionsTx(tx, ctx, quoteId);
    const version =
      (versionNumber ? versions.find((v) => v.versionNumber === versionNumber) : null) ??
      versions.find((v) => v.id === quote.currentVersionId) ??
      versions[versions.length - 1];
    if (!version) throw notFound("La versión");
    const content = await getVersionContentTx(tx, ctx, version.id);
    const brand = await getBrandTx(tx, ctx, quote.brandId);
    const client = quote.clientId ? await getClientTx(tx, ctx, quote.clientId) : null;
    const document =
      version.isLocked && version.snapshotJson
        ? (version.snapshotJson as QuoteDocumentSnapshot)
        : buildLiveSnapshot({ quote, version, content, brand, client, customDefs: null });
    const { balance, reference } = await getQuoteBalanceTx(tx, ctx, quoteId, versions);
    const rs = await tx
      .select()
      .from(receipts)
      .where(and(eq(receipts.quoteId, quoteId), eq(receipts.organizationId, ctx.organizationId)))
      .orderBy(desc(receipts.receivedAt));
    return {
      quote,
      versions,
      version,
      isCurrent: version.id === quote.currentVersionId,
      content,
      brand,
      client,
      document,
      balance,
      referenceVersionNumber: reference?.versionNumber ?? null,
      receipts: rs,
    };
  });
}

/** Documento para PDF/vista previa de una versión (snapshot si está emitida). */
export async function getQuoteDocument(ctx: TenantContext, quoteId: string, versionNumber?: number) {
  const d = await getQuoteDetail(ctx, quoteId, versionNumber);
  return { document: d.document, quote: d.quote, version: d.version };
}

function buildLiveSnapshot(args: {
  quote: QuoteRow;
  version: VersionRow;
  content: Awaited<ReturnType<typeof getVersionContentTx>>;
  brand: typeof brands.$inferSelect;
  client: typeof clients.$inferSelect | null;
  customDefs: CustomFieldDefinitionSnapshot[] | null;
}): QuoteDocumentSnapshot {
  const { quote, version, content, brand, client } = args;
  const { sections, totals } = buildSections(
    content.groups.map((g) => ({ id: g.id, title: g.title, showSubtotal: g.showSubtotal })),
    content.items,
  );
  const customFields = content.custom
    .map((c) => ({ def: c.definitionSnapshotJson as CustomFieldDefinitionSnapshot, value: c.valueJson }))
    .filter((c) => c.def.visibleInPdf && c.value !== null && c.value !== "" && c.value !== undefined)
    .sort((a, b) => a.def.sortOrder - b.def.sortOrder)
    .map((c) => ({ label: c.def.label, type: c.def.type, value: c.value as string | number | boolean }));
  return {
    kind: "quote",
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    templateVersion: TEMPLATE_VERSION,
    template: (version.pdfTemplate ?? brand.pdfTemplate) as PdfTemplate,
    paperSize: (version.paperSize ?? brand.paperSize) as PaperSize,
    folio: quote.folio,
    versionNumber: version.versionNumber,
    status: version.status as QuoteStatus,
    issueDate: version.issueDate,
    validUntil: version.validUntil,
    currency: version.currency,
    title: version.title,
    serviceDescription: version.serviceDescription,
    location: version.location,
    duration: version.duration,
    responsible: version.responsible,
    paymentTerms: version.paymentTerms,
    validityTerms: version.validityTerms,
    publicNotes: version.publicNotes,
    showUnitPrices: version.showUnitPrices,
    showOnlyGrandTotal: version.showOnlyGrandTotal,
    brand: brandSnapshot(brand),
    client: client ? partySnapshot(client) : null,
    sections,
    customFields,
    totals,
    frozenAt: null,
  };
}

// ---------------------------------------------------------------------------
// Listado / historial
// ---------------------------------------------------------------------------

export interface ListQuotesOptions {
  q?: string;
  status?: QuoteStatus | "ALL";
  brandId?: string;
  currency?: string;
  from?: string;
  to?: string;
  archived?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listQuotes(ctx: TenantContext, opts: ListQuotesOptions = {}) {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(50, opts.pageSize ?? 20);
  return withTenant(ctx, async (tx) => {
    const conds = [eq(quotes.organizationId, ctx.organizationId)];
    conds.push(opts.archived ? isNotNull(quotes.archivedAt) : isNull(quotes.archivedAt));
    if (opts.status && opts.status !== "ALL") conds.push(eq(quoteVersions.status, opts.status));
    if (opts.brandId) {
      assertUuid(opts.brandId, "La marca");
      conds.push(eq(quotes.brandId, opts.brandId));
    }
    if (opts.currency === "MXN" || opts.currency === "USD") conds.push(eq(quoteVersions.currency, opts.currency));
    if (opts.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from)) conds.push(gte(quotes.createdAt, new Date(`${opts.from}T00:00:00Z`)));
    if (opts.to && /^\d{4}-\d{2}-\d{2}$/.test(opts.to)) conds.push(lte(quotes.createdAt, new Date(`${opts.to}T23:59:59Z`)));
    const q = opts.q?.trim().slice(0, 100);
    if (q) {
      const p = likePattern(q);
      conds.push(
        or(ilike(quotes.folio, p), ilike(clients.name, p), ilike(quoteVersions.title, p), ilike(quoteVersions.serviceDescription, p))!,
      );
    }
    const where = and(...conds);
    const base = tx
      .select({ total: count() })
      .from(quotes)
      .innerJoin(quoteVersions, eq(quoteVersions.id, quotes.currentVersionId))
      .leftJoin(clients, eq(clients.id, quotes.clientId))
      .where(where);
    const [{ total }] = await base;
    const rows = await tx
      .select({
        id: quotes.id,
        folio: quotes.folio,
        createdAt: quotes.createdAt,
        updatedAt: quotes.updatedAt,
        archivedAt: quotes.archivedAt,
        versionNumber: quoteVersions.versionNumber,
        status: quoteVersions.status,
        title: quoteVersions.title,
        serviceDescription: quoteVersions.serviceDescription,
        currency: quoteVersions.currency,
        totalMinor: quoteVersions.totalMinor,
        issueDate: quoteVersions.issueDate,
        validUntil: quoteVersions.validUntil,
        clientName: clients.name,
        brandName: brands.name,
        brandColor: brands.colorPrimary,
      })
      .from(quotes)
      .innerJoin(quoteVersions, eq(quoteVersions.id, quotes.currentVersionId))
      .innerJoin(brands, eq(brands.id, quotes.brandId))
      .leftJoin(clients, eq(clients.id, quotes.clientId))
      .where(where)
      .orderBy(desc(quotes.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { rows, total, page, pageSize };
  });
}

/** Cotizaciones con saldo para vincular recibos (enviadas/aprobadas, no archivadas). */
export async function listPayableQuotes(ctx: TenantContext, q?: string) {
  return withTenant(ctx, async (tx) => {
    const conds = [
      eq(quotes.organizationId, ctx.organizationId),
      isNull(quotes.archivedAt),
      isNotNull(quotes.folio),
    ];
    if (q?.trim()) {
      const p = likePattern(q.trim().slice(0, 100));
      conds.push(or(ilike(quotes.folio, p), ilike(clients.name, p), ilike(quoteVersions.title, p))!);
    }
    return tx
      .select({
        id: quotes.id,
        folio: quotes.folio,
        title: quoteVersions.title,
        clientName: clients.name,
        currency: quoteVersions.currency,
        totalMinor: quoteVersions.totalMinor,
        status: quoteVersions.status,
      })
      .from(quotes)
      .innerJoin(quoteVersions, eq(quoteVersions.id, quotes.currentVersionId))
      .leftJoin(clients, eq(clients.id, quotes.clientId))
      .where(and(...conds))
      .orderBy(desc(quotes.updatedAt))
      .limit(30);
  });
}

// ---------------------------------------------------------------------------
// Creación y guardado
// ---------------------------------------------------------------------------

export async function createQuote(ctx: TenantContext, input: { brandId?: string | null; clientId?: string | null } = {}) {
  assertCan(ctx, "documents.write");
  return withTenant(ctx, async (tx) => {
    let brand;
    if (input.brandId) brand = await getBrandTx(tx, ctx, input.brandId);
    else {
      [brand] = await tx
        .select()
        .from(brands)
        .where(and(eq(brands.organizationId, ctx.organizationId), eq(brands.isActive, true)))
        .orderBy(asc(brands.createdAt))
        .limit(1);
    }
    if (!brand) throw validation("Primero configura una marca para emitir cotizaciones.");
    if (!brand.isActive) throw validation("La marca seleccionada está desactivada.");
    let client = null;
    if (input.clientId) client = await getClientTx(tx, ctx, input.clientId);
    const today = todayInTimeZone(ctx.timezone);
    const quoteId = randomUUID();
    const versionId = randomUUID();
    await tx.insert(quotes).values({
      id: quoteId,
      organizationId: ctx.organizationId,
      brandId: brand.id,
      clientId: client?.id ?? null,
      createdBy: ctx.userId,
    });
    await tx.insert(quoteVersions).values({
      id: versionId,
      quoteId,
      organizationId: ctx.organizationId,
      versionNumber: 1,
      status: "DRAFT",
      currency: client?.preferredCurrency ?? brand.defaultCurrency,
      issueDate: today,
      validUntil: brand.defaultValidityDays > 0 ? addDays(today, brand.defaultValidityDays) : null,
      paymentTerms: brand.defaultPaymentTerms,
      createdBy: ctx.userId,
    });
    await tx.update(quotes).set({ currentVersionId: versionId }).where(eq(quotes.id, quoteId));
    await audit(tx, ctx, "quote.create", "quote", quoteId);
    return { quoteId, versionId };
  });
}

function nullIfEmpty(s: string | null | undefined) {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t === "" ? null : s;
}

/** Valida números de cada línea y devuelve los importes recalculados en servidor. */
function computeItemsOrThrow(data: DraftData) {
  const groupIds = new Set(data.groups.map((g) => g.id));
  return data.items.map((it, idx) => {
    try {
      const n = normalizeLine(it);
      const r = computeLine(n);
      return {
        ...it,
        ...n,
        groupId: it.groupId && groupIds.has(it.groupId) ? it.groupId : null,
        unit: nullIfEmpty(it.unit),
        position: idx,
        result: r,
      };
    } catch (e) {
      if (e instanceof MoneyError) {
        throw validation(`Concepto ${idx + 1}: ${e.message}`, { [`items.${idx}`]: e.message });
      }
      throw e;
    }
  });
}

export interface SaveDraftResult {
  revision: number;
  updatedAt: string;
  totals: { grossMinor: number; discountMinor: number; subtotalMinor: number; taxMinor: number; totalMinor: number };
}

/**
 * Guarda el borrador (autoguardado). Control optimista: `revision` debe coincidir con la
 * almacenada; si otra pestaña guardó antes, responde CONFLICT sin sobrescribir.
 * El servidor recalcula todos los importes; nunca confía en totales del navegador.
 */
export async function saveDraft(
  ctx: TenantContext,
  quoteId: string,
  versionId: string,
  revision: number,
  input: DraftInput,
): Promise<SaveDraftResult> {
  assertCan(ctx, "documents.write");
  assertUuid(versionId, "La versión");
  const data = parseInput(draftSchema, input);
  const computed = computeItemsOrThrow(data);
  return withTenant(ctx, async (tx) => {
    const quote = await getQuoteRowTx(tx, ctx, quoteId, true);
    const [version] = await tx
      .select()
      .from(quoteVersions)
      .where(
        and(
          eq(quoteVersions.id, versionId),
          eq(quoteVersions.quoteId, quote.id),
          eq(quoteVersions.organizationId, ctx.organizationId),
        ),
      );
    if (!version) throw notFound("La versión");
    if (version.status !== "DRAFT" || version.isLocked) {
      throw conflict("Esta versión ya fue enviada y es de solo lectura. Crea una nueva versión para modificarla.");
    }
    if (version.revision !== revision) {
      throw conflict("La cotización se modificó en otra pestaña o dispositivo. Recarga para ver los cambios más recientes.");
    }
    const brand = await getBrandTx(tx, ctx, data.brandId);
    if (quote.folio && brand.id !== quote.brandId) {
      throw validation("La marca no puede cambiarse después de asignar folio.");
    }
    if (data.clientId) await getClientTx(tx, ctx, data.clientId);
    if (data.currency !== version.currency) {
      const { hasReceipts } = await getQuoteBalanceTx(tx, ctx, quote.id);
      if (hasReceipts) {
        throw validation("No se puede cambiar la moneda: ya existen recibos vinculados en otra moneda.");
      }
    }

    // Campos personalizados: valida contra la definición vigente y guarda snapshot de la definición.
    const defs = (await listCustomFieldsTx(tx, ctx)).map(toDefinitionSnapshot);
    const customRows = [];
    for (const def of defs) {
      const value = normalizeCustomValue(def, data.customValues[def.fieldKey]);
      if (value !== null) customRows.push({ def, value });
    }

    const { totals } = buildSections(
      data.groups.map((g) => ({ ...g })),
      computed.map((c) => ({ ...c, description: c.description })),
    );

    const newRevision = revision + 1;
    const now = new Date();
    const updated = await tx
      .update(quoteVersions)
      .set({
        revision: newRevision,
        title: nullIfEmpty(data.title),
        serviceDescription: nullIfEmpty(data.serviceDescription),
        location: nullIfEmpty(data.location),
        duration: nullIfEmpty(data.duration),
        responsible: nullIfEmpty(data.responsible),
        issueDate: data.issueDate,
        validUntil: data.validUntil,
        currency: data.currency,
        paymentTerms: nullIfEmpty(data.paymentTerms),
        validityTerms: nullIfEmpty(data.validityTerms),
        publicNotes: nullIfEmpty(data.publicNotes),
        internalNotes: nullIfEmpty(data.internalNotes),
        showUnitPrices: data.showUnitPrices,
        showOnlyGrandTotal: data.showOnlyGrandTotal,
        pdfTemplate: data.pdfTemplate,
        paperSize: data.paperSize,
        grossMinor: totals.grossMinor,
        discountMinor: totals.discountMinor,
        subtotalMinor: totals.subtotalMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        updatedAt: now,
      })
      .where(and(eq(quoteVersions.id, version.id), eq(quoteVersions.revision, revision)))
      .returning({ id: quoteVersions.id });
    if (updated.length === 0) throw conflict("La cotización se modificó en otra pestaña. Recarga para continuar.");

    await tx.delete(quoteItems).where(and(eq(quoteItems.quoteVersionId, version.id), eq(quoteItems.organizationId, ctx.organizationId)));
    await tx.delete(quoteGroups).where(and(eq(quoteGroups.quoteVersionId, version.id), eq(quoteGroups.organizationId, ctx.organizationId)));
    await tx
      .delete(quoteCustomValues)
      .where(and(eq(quoteCustomValues.quoteVersionId, version.id), eq(quoteCustomValues.organizationId, ctx.organizationId)));

    if (data.groups.length) {
      await tx.insert(quoteGroups).values(
        data.groups.map((g, i) => ({
          id: g.id,
          organizationId: ctx.organizationId,
          quoteVersionId: version.id,
          title: g.title.trim() || "Sección",
          position: i,
          showSubtotal: g.showSubtotal,
        })),
      );
    }
    if (computed.length) {
      await tx.insert(quoteItems).values(
        computed.map((c) => ({
          id: c.id,
          organizationId: ctx.organizationId,
          quoteVersionId: version.id,
          groupId: c.groupId,
          position: c.position,
          description: c.description,
          unit: c.unit,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          discountType: c.discountType,
          discountValue: c.discountValue,
          taxMode: c.taxMode,
          taxRate: c.taxRate,
          hideUnitPriceInPdf: c.hideUnitPriceInPdf,
          ...c.result,
        })),
      );
    }
    if (customRows.length) {
      await tx.insert(quoteCustomValues).values(
        customRows.map((r) => ({
          organizationId: ctx.organizationId,
          quoteVersionId: version.id,
          fieldKey: r.def.fieldKey,
          definitionSnapshotJson: r.def,
          valueJson: r.value,
        })),
      );
    }
    await tx
      .update(quotes)
      .set({ brandId: brand.id, clientId: data.clientId, updatedAt: now })
      .where(eq(quotes.id, quote.id));
    return {
      revision: newRevision,
      updatedAt: now.toISOString(),
      totals: {
        grossMinor: totals.grossMinor,
        discountMinor: totals.discountMinor,
        subtotalMinor: totals.subtotalMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Estados y versiones
// ---------------------------------------------------------------------------

/** Requisitos para enviar/emitir: cliente, marca, al menos un concepto con descripción y moneda. */
export function validateQuoteForIssue(args: {
  clientId: string | null;
  brandActive: boolean;
  currency: string;
  items: Array<{ description: string }>;
  customDefs: CustomFieldDefinitionSnapshot[];
  customValues: Record<string, unknown>;
}): string[] {
  const problems: string[] = [];
  if (!args.clientId) problems.push("Selecciona un cliente.");
  if (!args.brandActive) problems.push("La marca está desactivada.");
  if (args.currency !== "MXN" && args.currency !== "USD") problems.push("Selecciona una moneda válida.");
  if (args.items.length === 0) problems.push("Agrega al menos un concepto.");
  args.items.forEach((it, i) => {
    if (!it.description.trim()) problems.push(`El concepto ${i + 1} no tiene descripción.`);
  });
  for (const d of args.customDefs) {
    const v = args.customValues[d.fieldKey];
    if (d.required && (v === undefined || v === null || v === "")) problems.push(`Completa el campo "${d.label}".`);
  }
  return problems;
}

export async function changeQuoteStatus(ctx: TenantContext, quoteId: string, to: QuoteStatus) {
  assertCan(ctx, "documents.write");
  return withTenant(ctx, async (tx) => {
    const quote = await getQuoteRowTx(tx, ctx, quoteId, true);
    if (quote.archivedAt) throw conflict("La cotización está archivada.");
    const [version] = await tx
      .select()
      .from(quoteVersions)
      .where(and(eq(quoteVersions.id, quote.currentVersionId!), eq(quoteVersions.organizationId, ctx.organizationId)))
      .for("update");
    if (!version) throw notFound("La versión");
    const from = version.status as QuoteStatus;
    if (!canTransition(from, to)) {
      throw conflict(`No se puede pasar de "${QUOTE_STATUS_LABEL[from]}" a "${QUOTE_STATUS_LABEL[to]}".`);
    }
    const now = new Date();
    const patch: Partial<VersionRow> = { status: to, updatedAt: now };

    if (from === "DRAFT" && to === "SENT") {
      const content = await getVersionContentTx(tx, ctx, version.id);
      const brand = await getBrandTx(tx, ctx, quote.brandId);
      const client = quote.clientId ? await getClientTx(tx, ctx, quote.clientId) : null;
      const defs = (await listCustomFieldsTx(tx, ctx)).map(toDefinitionSnapshot);
      const customValues = Object.fromEntries(content.custom.map((c) => [c.fieldKey, c.valueJson]));
      const problems = validateQuoteForIssue({
        clientId: quote.clientId,
        brandActive: brand.isActive,
        currency: version.currency,
        items: content.items,
        customDefs: defs,
        customValues,
      });
      if (problems.length) throw new AppError("VALIDATION_ERROR", problems.join(" "));

      let folio = quote.folio;
      if (!folio) {
        const [org] = await tx.select().from(organizations).where(eq(organizations.id, ctx.organizationId));
        const year = yearInTimeZone(org?.timezone ?? ctx.timezone);
        const seq = await generateNextFolio(tx, {
          organizationId: ctx.organizationId,
          prefix: brand.quotePrefix,
          documentType: "QUOTE",
          year,
          padding: brand.folioPadding,
        });
        folio = seq.folio;
        await tx
          .update(quotes)
          .set({ folio, sequenceNo: seq.number, folioYear: year })
          .where(eq(quotes.id, quote.id));
      }
      const issueDate = version.issueDate ?? todayInTimeZone(ctx.timezone);
      const snapshot = buildLiveSnapshot({
        quote: { ...quote, folio },
        version: { ...version, issueDate, status: "SENT" },
        content,
        brand,
        client,
        customDefs: defs,
      });
      snapshot.frozenAt = now.toISOString();
      // Verificación de integridad: los totales persistidos deben coincidir con el recálculo.
      if (snapshot.totals.totalMinor !== version.totalMinor) {
        throw new AppError("INTERNAL_ERROR", "Los totales guardados no coinciden con el recálculo. Guarda de nuevo.");
      }
      Object.assign(patch, {
        isLocked: true,
        lockReason: "SENT",
        sentAt: now,
        issueDate,
        snapshotJson: snapshot,
      });
    } else {
      // Para transiciones posteriores, el snapshot se conserva y solo se actualiza el estado mostrado.
      const snap = version.snapshotJson as QuoteDocumentSnapshot | null;
      if (snap) patch.snapshotJson = { ...snap, status: to };
      if (to === "APPROVED") patch.approvedAt = now;
      if (to === "REJECTED") patch.rejectedAt = now;
      if (to === "EXPIRED") patch.expiredAt = now;
    }
    await tx.update(quoteVersions).set(patch).where(eq(quoteVersions.id, version.id));
    await tx.update(quotes).set({ updatedAt: now }).where(eq(quotes.id, quote.id));
    await audit(tx, ctx, "quote.status_change", "quote", quote.id, { from, to, version: version.versionNumber });
    return { status: to };
  });
}

async function copyVersionContent(tx: Tx, ctx: TenantContext, fromVersionId: string, toVersionId: string) {
  const content = await getVersionContentTx(tx, ctx, fromVersionId);
  const groupMap = new Map<string, string>();
  if (content.groups.length) {
    const rows = content.groups.map((g) => {
      const id = randomUUID();
      groupMap.set(g.id, id);
      return { ...g, id, quoteVersionId: toVersionId };
    });
    await tx.insert(quoteGroups).values(rows);
  }
  if (content.items.length) {
    await tx.insert(quoteItems).values(
      content.items.map((it) => ({
        ...it,
        id: randomUUID(),
        quoteVersionId: toVersionId,
        groupId: it.groupId ? (groupMap.get(it.groupId) ?? null) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }
  if (content.custom.length) {
    await tx
      .insert(quoteCustomValues)
      .values(content.custom.map((c) => ({ ...c, id: randomUUID(), quoteVersionId: toVersionId })));
  }
}

/**
 * Crea una nueva versión (V2, V3…) duplicando transaccionalmente el contenido de la actual.
 * Las versiones anteriores quedan intactas y de solo lectura. Los recibos existentes siguen
 * vinculados a la versión con la que se pagaron.
 */
export async function createQuoteVersion(ctx: TenantContext, quoteId: string) {
  assertCan(ctx, "documents.write");
  return withTenant(ctx, async (tx) => {
    const quote = await getQuoteRowTx(tx, ctx, quoteId, true);
    const versions = await getVersionsTx(tx, ctx, quoteId);
    const current = versions.find((v) => v.id === quote.currentVersionId)!;
    if (current.status === "DRAFT") throw conflict("La versión actual todavía es un borrador; edítala directamente.");
    const next = Math.max(...versions.map((v) => v.versionNumber)) + 1;
    const id = randomUUID();
    const now = new Date();
    await tx.insert(quoteVersions).values({
      ...current,
      id,
      versionNumber: next,
      status: "DRAFT",
      revision: 1,
      snapshotJson: null,
      isLocked: false,
      lockReason: null,
      sentAt: null,
      approvedAt: null,
      rejectedAt: null,
      expiredAt: null,
      issueDate: todayInTimeZone(ctx.timezone),
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });
    await copyVersionContent(tx, ctx, current.id, id);
    await tx.update(quotes).set({ currentVersionId: id, updatedAt: now }).where(eq(quotes.id, quote.id));
    await audit(tx, ctx, "quote.version_create", "quote", quote.id, { version: next });
    return { versionNumber: next, versionId: id };
  });
}

/** Duplica una versión como una cotización NUEVA (folio nuevo al enviarse). */
export async function duplicateQuote(ctx: TenantContext, quoteId: string, versionNumber?: number) {
  assertCan(ctx, "documents.write");
  return withTenant(ctx, async (tx) => {
    const quote = await getQuoteRowTx(tx, ctx, quoteId);
    const versions = await getVersionsTx(tx, ctx, quoteId);
    const src =
      (versionNumber ? versions.find((v) => v.versionNumber === versionNumber) : null) ??
      versions.find((v) => v.id === quote.currentVersionId)!;
    const newQuoteId = randomUUID();
    const newVersionId = randomUUID();
    const now = new Date();
    await tx.insert(quotes).values({
      id: newQuoteId,
      organizationId: ctx.organizationId,
      brandId: quote.brandId,
      clientId: quote.clientId,
      createdBy: ctx.userId,
    });
    await tx.insert(quoteVersions).values({
      ...src,
      id: newVersionId,
      quoteId: newQuoteId,
      versionNumber: 1,
      status: "DRAFT",
      revision: 1,
      title: src.title ? `${src.title} (copia)` : "Copia",
      snapshotJson: null,
      isLocked: false,
      lockReason: null,
      sentAt: null,
      approvedAt: null,
      rejectedAt: null,
      expiredAt: null,
      issueDate: todayInTimeZone(ctx.timezone),
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });
    await copyVersionContent(tx, ctx, src.id, newVersionId);
    await tx.update(quotes).set({ currentVersionId: newVersionId }).where(eq(quotes.id, newQuoteId));
    await audit(tx, ctx, "quote.duplicate", "quote", newQuoteId, { from: quote.folio ?? quote.id });
    return { quoteId: newQuoteId };
  });
}

export async function archiveQuote(ctx: TenantContext, quoteId: string, archived = true) {
  assertCan(ctx, "documents.write");
  await withTenant(ctx, async (tx) => {
    const quote = await getQuoteRowTx(tx, ctx, quoteId, true);
    await tx
      .update(quotes)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(eq(quotes.id, quote.id));
    await audit(tx, ctx, "quote.archive", "quote", quote.id, { archived });
  });
}

// ---------------------------------------------------------------------------
// Datos para el editor
// ---------------------------------------------------------------------------

export async function getEditorData(ctx: TenantContext, quoteId: string) {
  return withTenant(ctx, async (tx) => {
    const quote = await getQuoteRowTx(tx, ctx, quoteId);
    const [version] = await tx
      .select()
      .from(quoteVersions)
      .where(and(eq(quoteVersions.id, quote.currentVersionId!), eq(quoteVersions.organizationId, ctx.organizationId)));
    if (!version) throw notFound("La versión");
    const content = await getVersionContentTx(tx, ctx, version.id);
    const customDefs = (await listCustomFieldsTx(tx, ctx)).map(toDefinitionSnapshot);
    const { hasReceipts } = await getQuoteBalanceTx(tx, ctx, quote.id);
    const client = quote.clientId ? await getClientTx(tx, ctx, quote.clientId) : null;
    const draft: DraftData = {
      brandId: quote.brandId,
      clientId: quote.clientId,
      title: version.title ?? "",
      serviceDescription: version.serviceDescription ?? "",
      location: version.location ?? "",
      duration: version.duration ?? "",
      responsible: version.responsible ?? "",
      issueDate: version.issueDate,
      validUntil: version.validUntil,
      currency: version.currency as DraftData["currency"],
      paymentTerms: version.paymentTerms ?? "",
      validityTerms: version.validityTerms ?? "",
      publicNotes: version.publicNotes ?? "",
      internalNotes: version.internalNotes ?? "",
      showUnitPrices: version.showUnitPrices,
      showOnlyGrandTotal: version.showOnlyGrandTotal,
      pdfTemplate: (version.pdfTemplate as DraftData["pdfTemplate"]) ?? null,
      paperSize: (version.paperSize as DraftData["paperSize"]) ?? null,
      groups: content.groups.map((g) => ({ id: g.id, title: g.title, showSubtotal: g.showSubtotal })),
      items: content.items.map((it) => ({
        id: it.id,
        groupId: it.groupId,
        description: it.description,
        unit: it.unit,
        quantity: trimZeros(it.quantity),
        unitPrice: trimZeros(it.unitPrice, 2),
        discountType: it.discountType as DraftData["items"][number]["discountType"],
        discountValue: trimZeros(it.discountValue),
        taxMode: it.taxMode as DraftData["items"][number]["taxMode"],
        taxRate: trimZeros(it.taxRate),
        hideUnitPriceInPdf: it.hideUnitPriceInPdf,
      })),
      customValues: Object.fromEntries(
        content.custom.map((c) => [c.fieldKey, c.valueJson as string | number | boolean | null]),
      ),
    };
    return {
      quote,
      version,
      draft,
      customDefs,
      hasReceipts,
      client: client ? { id: client.id, name: client.name, email: client.email, taxId: client.taxId } : null,
    };
  });
}

/** "3.0000" -> "3"; con minDecimals=2: "300.0000" -> "300.00". */
export function trimZeros(v: string, minDecimals = 0): string {
  if (!v.includes(".")) return minDecimals ? `${v}.${"0".repeat(minDecimals)}` : v;
  let [i, d] = v.split(".");
  d = d.replace(/0+$/, "");
  if (d.length < minDecimals) d = d.padEnd(minDecimals, "0");
  return d ? `${i}.${d}` : i;
}

// ---------------------------------------------------------------------------
// Cuadro de mando
// ---------------------------------------------------------------------------

export async function getDashboard(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const statusCounts = await tx
      .select({ status: quoteVersions.status, n: count() })
      .from(quotes)
      .innerJoin(quoteVersions, eq(quoteVersions.id, quotes.currentVersionId))
      .where(and(eq(quotes.organizationId, ctx.organizationId), isNull(quotes.archivedAt)))
      .groupBy(quoteVersions.status);

    // Pendiente de cobro por moneda (nunca se mezclan MXN y USD): versión de referencia − recibos activos.
    const pending = await tx.execute<{ currency: string; pending_minor: string; quotes_count: string }>(sql`
      with ref as (
        select distinct on (v.quote_id) v.quote_id, v.currency, v.total_minor
        from quote_versions v
        join quotes q on q.id = v.quote_id and q.archived_at is null
        where v.organization_id = ${ctx.organizationId} and v.status in ('APPROVED','SENT')
        order by v.quote_id, (v.status = 'APPROVED') desc, v.version_number desc
      ), paid as (
        select r.quote_id, sum(r.amount_minor) as paid
        from receipts r
        where r.organization_id = ${ctx.organizationId} and r.status = 'ISSUED' and r.quote_id is not null
        group by r.quote_id
      )
      select ref.currency, sum(greatest(ref.total_minor - coalesce(paid.paid, 0), 0)) as pending_minor,
             count(*) filter (where ref.total_minor - coalesce(paid.paid, 0) > 0) as quotes_count
      from ref left join paid on paid.quote_id = ref.quote_id
      group by ref.currency
      order by ref.currency
    `);
    return {
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s.n])) as Partial<Record<QuoteStatus, number>>,
      pending: pending.rows.map((r) => ({
        currency: r.currency,
        pendingMinor: Number(r.pending_minor),
        quotesCount: Number(r.quotes_count),
      })),
    };
  });
}

export async function quoteIdsExist(ctx: TenantContext, ids: string[]) {
  return withTenant(ctx, async (tx) =>
    tx
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.organizationId, ctx.organizationId), inArray(quotes.id, ids))),
  );
}
