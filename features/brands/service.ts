import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { brands, files } from "@/lib/db/schema";
import type { Tx } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { CURRENCIES, TAX_MODES } from "@/lib/money";
import { storage } from "@/lib/storage";
import { normalizeLogo } from "@/lib/storage/image";
import { assertCan, assertUuid, withTenant, type TenantContext } from "@/lib/security/tenant";
import { hexColor, optionalEmail, optionalRfc, optionalText, parseInput } from "@/lib/validation";
import { normalizePrefix } from "@/lib/utils/folio";
import { audit } from "@/features/audit/service";

import { DEFAULT_BRAND_STYLE, FONT_FAMILIES, PAPER_SIZES, PDF_TEMPLATES } from "./constants";
export * from "./constants";

const prefix = z
  .string()
  .trim()
  .min(1, "Prefijo obligatorio")
  .max(12, "Máximo 12 caracteres")
  .transform((v, ctx) => {
    try {
      return normalizePrefix(v);
    } catch {
      ctx.addIssue({ code: "custom", message: "Usa letras, números o guiones" });
      return z.NEVER;
    }
  });

export const brandSchema = z.object({
  name: z.string().trim().min(1, "El nombre comercial es obligatorio").max(160),
  legalName: optionalText(200),
  taxId: optionalRfc,
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalText(200),
  address: optionalText(500),
  contactName: optionalText(160),
  colorPrimary: hexColor.default(DEFAULT_BRAND_STYLE.colorPrimary),
  colorSecondary: hexColor.default(DEFAULT_BRAND_STYLE.colorSecondary),
  colorAccent: hexColor.default(DEFAULT_BRAND_STYLE.colorAccent),
  colorText: hexColor.default(DEFAULT_BRAND_STYLE.colorText),
  fontFamily: z.enum(FONT_FAMILIES).default("INTER"),
  headerText: optionalText(300),
  footerText: optionalText(600),
  commercialMessage: optionalText(1000),
  signatureName: optionalText(160),
  signatureTitle: optionalText(160),
  bankName: optionalText(120),
  bankBeneficiary: optionalText(160),
  bankAccount: optionalText(60),
  bankInstructions: optionalText(600),
  showBankDetails: z.coerce.boolean().default(false),
  defaultCurrency: z.enum(CURRENCIES).default("MXN"),
  defaultTaxMode: z.enum(TAX_MODES).default("EXCLUSIVE"),
  defaultTaxRate: z.coerce.number().min(0, "Tasa inválida").max(100, "Tasa inválida").default(16),
  defaultRetentionIvaRate: z.coerce.number().min(0, "Tasa inválida").max(100, "Tasa inválida").default(0),
  defaultRetentionIsrRate: z.coerce.number().min(0, "Tasa inválida").max(100, "Tasa inválida").default(0),
  defaultPaymentTerms: optionalText(2000),
  defaultValidityDays: z.coerce.number().int().min(0).max(365).default(15),
  quotePrefix: prefix.default("COT"),
  receiptPrefix: prefix.default("REC"),
  folioPadding: z.coerce.number().int().min(1).max(8).default(4),
  pdfTemplate: z.enum(PDF_TEMPLATES).default("MINIMAL"),
  paperSize: z.enum(PAPER_SIZES).default("LETTER"),
  isActive: z.coerce.boolean().default(true),
});

export type BrandInput = z.input<typeof brandSchema>;
export type Brand = typeof brands.$inferSelect;

function toRow(data: z.output<typeof brandSchema>) {
  return {
    ...data,
    defaultTaxRate: String(data.defaultTaxRate),
    defaultRetentionIvaRate: String(data.defaultRetentionIvaRate),
    defaultRetentionIsrRate: String(data.defaultRetentionIsrRate),
  };
}

export async function listBrands(ctx: TenantContext, opts: { activeOnly?: boolean } = {}) {
  return withTenant(ctx, (tx) => listBrandsTx(tx, ctx, opts));
}

export async function listBrandsTx(tx: Tx, ctx: TenantContext, opts: { activeOnly?: boolean } = {}) {
  const where = opts.activeOnly
    ? and(eq(brands.organizationId, ctx.organizationId), eq(brands.isActive, true))
    : eq(brands.organizationId, ctx.organizationId);
  return tx.select().from(brands).where(where).orderBy(asc(brands.createdAt));
}

export async function getBrandTx(tx: Tx, ctx: TenantContext, brandId: string) {
  assertUuid(brandId, "La marca");
  const [b] = await tx
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.organizationId, ctx.organizationId)));
  if (!b) throw notFound("La marca");
  return b;
}

export async function getBrand(ctx: TenantContext, brandId: string) {
  return withTenant(ctx, (tx) => getBrandTx(tx, ctx, brandId));
}

export async function createBrand(ctx: TenantContext, input: BrandInput) {
  assertCan(ctx, "brands.manage");
  const data = parseInput(brandSchema, input);
  return withTenant(ctx, async (tx) => {
    const [b] = await tx
      .insert(brands)
      .values({ organizationId: ctx.organizationId, ...toRow(data) })
      .returning();
    await audit(tx, ctx, "brand.create", "brand", b.id);
    return b;
  });
}

export async function updateBrand(ctx: TenantContext, brandId: string, input: BrandInput) {
  assertCan(ctx, "brands.manage");
  const data = parseInput(brandSchema, input);
  return withTenant(ctx, async (tx) => {
    await getBrandTx(tx, ctx, brandId);
    const [b] = await tx
      .update(brands)
      .set({ ...toRow(data), updatedAt: new Date() })
      .where(and(eq(brands.id, brandId), eq(brands.organizationId, ctx.organizationId)))
      .returning();
    await audit(tx, ctx, "brand.update", "brand", brandId);
    return b;
  });
}

/**
 * Sube un logo nuevo. Cada carga crea un archivo NUEVO e inmutable: los documentos
 * emitidos conservan la referencia al logo con el que se emitieron.
 */
export async function uploadBrandLogo(ctx: TenantContext, brandId: string, raw: Buffer) {
  assertCan(ctx, "brands.manage");
  const img = await normalizeLogo(raw);
  return withTenant(ctx, async (tx) => {
    await getBrandTx(tx, ctx, brandId);
    const fileId = randomUUID();
    const key = `${ctx.organizationId}/${fileId}.${img.ext}`;
    await tx.insert(files).values({
      id: fileId,
      organizationId: ctx.organizationId,
      ownerType: "brand_logo",
      ownerId: brandId,
      storageKey: key,
      mimeType: img.mimeType,
      size: img.data.length,
      width: img.width,
      height: img.height,
      checksum: img.checksum,
    });
    await storage().put(tx, { organizationId: ctx.organizationId, fileId, key, data: img.data });
    await tx
      .update(brands)
      .set({ logoFileId: fileId, updatedAt: new Date() })
      .where(and(eq(brands.id, brandId), eq(brands.organizationId, ctx.organizationId)));
    await audit(tx, ctx, "brand.logo_upload", "brand", brandId, { width: img.width, height: img.height });
    return { fileId };
  });
}

export async function removeBrandLogo(ctx: TenantContext, brandId: string) {
  assertCan(ctx, "brands.manage");
  await withTenant(ctx, async (tx) => {
    await getBrandTx(tx, ctx, brandId);
    await tx
      .update(brands)
      .set({ logoFileId: null, updatedAt: new Date() })
      .where(and(eq(brands.id, brandId), eq(brands.organizationId, ctx.organizationId)));
    await audit(tx, ctx, "brand.update", "brand", brandId, { logo: "removed" });
  });
}

/** Lee un archivo privado verificando que pertenece a la organización activa. */
export async function readFileTx(tx: Tx, ctx: Pick<TenantContext, "organizationId">, fileId: string) {
  assertUuid(fileId, "El archivo");
  const [f] = await tx
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.organizationId, ctx.organizationId)));
  if (!f) throw notFound("El archivo");
  const data = await storage().get(tx, { organizationId: ctx.organizationId, fileId: f.id, key: f.storageKey });
  if (!data) throw notFound("El archivo");
  return { file: f, data };
}

export async function readFile(ctx: TenantContext, fileId: string) {
  return withTenant(ctx, (tx) => readFileTx(tx, ctx, fileId));
}
