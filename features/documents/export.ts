import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { brands, clients, quoteVersions, quotes, receipts } from "@/lib/db/schema";
import { assertCan, withTenant, type TenantContext } from "@/lib/security/tenant";
import { minorToDecimalString } from "@/lib/money";

export type ExportKind = "clientes" | "cotizaciones" | "recibos";

/** Escapa CSV y neutraliza fórmulas (=, +, -, @) para evitar inyección en hojas de cálculo. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Exportación limitada a la organización activa; excluye secretos y notas internas. */
export async function exportCsv(ctx: TenantContext, kind: ExportKind): Promise<string> {
  assertCan(ctx, "data.export");
  return withTenant(ctx, async (tx) => {
    if (kind === "clientes") {
      const rows = await tx.select().from(clients).where(eq(clients.organizationId, ctx.organizationId)).orderBy(asc(clients.name));
      return toCsv(
        ["nombre", "razon_social", "rfc", "correo", "telefono", "contacto", "domicilio", "moneda_preferida", "archivado", "creado"],
        rows.map((c) => [c.name, c.businessName, c.taxId, c.email, c.phone, c.contactName, c.address, c.preferredCurrency, c.archivedAt ? "si" : "no", c.createdAt]),
      );
    }
    if (kind === "cotizaciones") {
      const rows = await tx
        .select({
          folio: quotes.folio,
          version: quoteVersions.versionNumber,
          status: quoteVersions.status,
          title: quoteVersions.title,
          client: clients.name,
          brand: brands.name,
          currency: quoteVersions.currency,
          subtotal: quoteVersions.subtotalMinor,
          tax: quoteVersions.taxMinor,
          total: quoteVersions.totalMinor,
          issueDate: quoteVersions.issueDate,
          validUntil: quoteVersions.validUntil,
          createdAt: quoteVersions.createdAt,
        })
        .from(quoteVersions)
        .innerJoin(quotes, eq(quotes.id, quoteVersions.quoteId))
        .innerJoin(brands, eq(brands.id, quotes.brandId))
        .leftJoin(clients, eq(clients.id, quotes.clientId))
        .where(eq(quoteVersions.organizationId, ctx.organizationId))
        .orderBy(desc(quoteVersions.createdAt));
      return toCsv(
        ["folio", "version", "estado", "titulo", "cliente", "marca", "moneda", "subtotal", "iva", "total", "fecha_emision", "vigencia", "creada"],
        rows.map((r) => [r.folio ?? "BORRADOR", r.version, r.status, r.title, r.client, r.brand, r.currency, minorToDecimalString(r.subtotal), minorToDecimalString(r.tax), minorToDecimalString(r.total), r.issueDate, r.validUntil, r.createdAt]),
      );
    }
    const rows = await tx
      .select({ r: receipts, quoteFolio: quotes.folio, brand: brands.name })
      .from(receipts)
      .innerJoin(brands, eq(brands.id, receipts.brandId))
      .leftJoin(quotes, eq(quotes.id, receipts.quoteId))
      .where(eq(receipts.organizationId, ctx.organizationId))
      .orderBy(desc(receipts.receivedAt));
    return toCsv(
      ["folio", "estado", "pagador", "concepto", "metodo", "referencia", "recibido", "moneda", "importe", "base", "iva", "cotizacion", "marca", "motivo_anulacion"],
      rows.map(({ r, quoteFolio, brand }) => [r.folio, r.status, r.payerName, r.concept, r.paymentMethod, r.paymentReference, r.receivedAt, r.currency, minorToDecimalString(r.amountMinor), minorToDecimalString(r.netMinor), minorToDecimalString(r.taxMinor), quoteFolio, brand, r.voidReason]),
    );
  });
}
