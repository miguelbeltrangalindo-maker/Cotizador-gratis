import { and, asc, count, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { catalogItems } from "@/lib/db/schema";
import { notFound } from "@/lib/errors";
import { CURRENCIES, TAX_MODES, normalizeLine } from "@/lib/money";
import { assertCan, assertUuid, withTenant, type TenantContext } from "@/lib/security/tenant";
import { decimalString, optionalText, parseInput } from "@/lib/validation";
import { audit } from "@/features/audit/service";
import { getBrandTx } from "@/features/brands/service";
import { likePattern } from "@/features/clients/service";

export const UNITS = ["pieza", "servicio", "jornada", "hora", "día", "sesión", "paquete", "mes", "otra"] as const;

export const catalogSchema = z.object({
  title: z.string().trim().min(1, "El nombre del concepto es obligatorio").max(300),
  description: optionalText(10000),
  unit: optionalText(40),
  suggestedPrice: decimalString("Precio sugerido").default("0"),
  currency: z.enum(CURRENCIES).default("MXN"),
  taxMode: z.enum(TAX_MODES).default("EXCLUSIVE"),
  taxRate: decimalString("Tasa").default("16"),
  brandId: z.string().uuid().optional().nullable().transform((v) => v || null),
});
export type CatalogInput = z.input<typeof catalogSchema>;

function validateNumbers(data: z.output<typeof catalogSchema>) {
  // Reutiliza las reglas del motor de dinero para precio y tasa.
  const n = normalizeLine({ quantity: 1, unitPrice: data.suggestedPrice, taxMode: data.taxMode, taxRate: data.taxRate });
  return { ...data, suggestedPrice: n.unitPrice, taxRate: n.taxRate };
}

export async function listCatalogItems(
  ctx: TenantContext,
  opts: { q?: string; page?: number; archived?: boolean; pageSize?: number } = {},
) {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  return withTenant(ctx, async (tx) => {
    const conds = [eq(catalogItems.organizationId, ctx.organizationId)];
    conds.push(opts.archived ? isNotNull(catalogItems.archivedAt) : isNull(catalogItems.archivedAt));
    const q = opts.q?.trim().slice(0, 100);
    if (q) conds.push(or(ilike(catalogItems.title, likePattern(q)), ilike(catalogItems.description, likePattern(q)))!);
    const where = and(...conds);
    const [{ total }] = await tx.select({ total: count() }).from(catalogItems).where(where);
    const rows = await tx
      .select()
      .from(catalogItems)
      .where(where)
      .orderBy(asc(catalogItems.title))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { rows, total, page, pageSize };
  });
}

export async function createCatalogItem(ctx: TenantContext, input: CatalogInput) {
  assertCan(ctx, "documents.write");
  const data = validateNumbers(parseInput(catalogSchema, input));
  return withTenant(ctx, async (tx) => {
    if (data.brandId) await getBrandTx(tx, ctx, data.brandId);
    const [row] = await tx
      .insert(catalogItems)
      .values({ organizationId: ctx.organizationId, ...data })
      .returning();
    await audit(tx, ctx, "catalog.create", "catalog_item", row.id);
    return row;
  });
}

export async function updateCatalogItem(ctx: TenantContext, id: string, input: CatalogInput) {
  assertCan(ctx, "catalog.manage");
  assertUuid(id, "El concepto");
  const data = validateNumbers(parseInput(catalogSchema, input));
  return withTenant(ctx, async (tx) => {
    if (data.brandId) await getBrandTx(tx, ctx, data.brandId);
    const [row] = await tx
      .update(catalogItems)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(catalogItems.id, id), eq(catalogItems.organizationId, ctx.organizationId)))
      .returning();
    if (!row) throw notFound("El concepto");
    await audit(tx, ctx, "catalog.update", "catalog_item", id);
    return row;
  });
}

export async function archiveCatalogItem(ctx: TenantContext, id: string, archived = true) {
  assertCan(ctx, "catalog.manage");
  assertUuid(id, "El concepto");
  await withTenant(ctx, async (tx) => {
    const res = await tx
      .update(catalogItems)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(catalogItems.id, id), eq(catalogItems.organizationId, ctx.organizationId)))
      .returning({ id: catalogItems.id });
    if (res.length === 0) throw notFound("El concepto");
    await audit(tx, ctx, "catalog.update", "catalog_item", id, { archived });
  });
}
