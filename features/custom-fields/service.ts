import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { customFieldDefinitions } from "@/lib/db/schema";
import type { Tx } from "@/lib/db";
import { notFound, validation } from "@/lib/errors";
import { assertCan, assertUuid, withTenant, type TenantContext } from "@/lib/security/tenant";
import { parseInput } from "@/lib/validation";
import { slugify } from "@/lib/utils/text";
import { isIsoDate } from "@/lib/utils/dates";

export const CUSTOM_FIELD_TYPES = ["short_text", "long_text", "number", "date", "select", "checkbox"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];
export const CUSTOM_FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  short_text: "Texto corto",
  long_text: "Texto largo",
  number: "Número",
  date: "Fecha",
  select: "Lista de opciones",
  checkbox: "Casilla (sí/no)",
};

export const customFieldSchema = z.object({
  label: z.string().trim().min(1, "La etiqueta es obligatoria").max(80),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  required: z.boolean().default(false),
  visibleInPdf: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export interface CustomFieldDefinitionSnapshot {
  fieldKey: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  visibleInPdf: boolean;
  sortOrder: number;
}

export type CustomValue = string | number | boolean | null;

export async function listCustomFieldsTx(tx: Tx, ctx: TenantContext, includeArchived = false) {
  const where = includeArchived
    ? eq(customFieldDefinitions.organizationId, ctx.organizationId)
    : and(eq(customFieldDefinitions.organizationId, ctx.organizationId), isNull(customFieldDefinitions.archivedAt));
  return tx
    .select()
    .from(customFieldDefinitions)
    .where(where)
    .orderBy(asc(customFieldDefinitions.sortOrder), asc(customFieldDefinitions.createdAt));
}

export async function listCustomFields(ctx: TenantContext, includeArchived = false) {
  return withTenant(ctx, (tx) => listCustomFieldsTx(tx, ctx, includeArchived));
}

export function toDefinitionSnapshot(d: typeof customFieldDefinitions.$inferSelect): CustomFieldDefinitionSnapshot {
  return {
    fieldKey: d.fieldKey,
    label: d.label,
    type: d.type as CustomFieldType,
    options: d.optionsJson ?? [],
    required: d.required,
    visibleInPdf: d.visibleInPdf,
    sortOrder: d.sortOrder,
  };
}

export async function createCustomField(ctx: TenantContext, input: z.input<typeof customFieldSchema>) {
  assertCan(ctx, "customFields.manage");
  const data = parseInput(customFieldSchema, input);
  if (data.type === "select" && data.options.length === 0) {
    throw validation("Agrega al menos una opción a la lista.", { options: "Sin opciones" });
  }
  return withTenant(ctx, async (tx) => {
    const base = slugify(data.label).replace(/-/g, "_").slice(0, 40) || "campo";
    const existing = await listCustomFieldsTx(tx, ctx, true);
    let key = base;
    for (let i = 2; existing.some((e) => e.fieldKey === key); i++) key = `${base}_${i}`;
    const [row] = await tx
      .insert(customFieldDefinitions)
      .values({
        organizationId: ctx.organizationId,
        fieldKey: key,
        label: data.label,
        type: data.type,
        optionsJson: data.type === "select" ? data.options : null,
        required: data.required,
        visibleInPdf: data.visibleInPdf,
        sortOrder: data.sortOrder,
      })
      .returning();
    return row;
  });
}

export async function updateCustomField(ctx: TenantContext, id: string, input: z.input<typeof customFieldSchema>) {
  assertCan(ctx, "customFields.manage");
  assertUuid(id, "El campo");
  const data = parseInput(customFieldSchema, input);
  return withTenant(ctx, async (tx) => {
    const [row] = await tx
      .update(customFieldDefinitions)
      .set({
        label: data.label,
        type: data.type,
        optionsJson: data.type === "select" ? data.options : null,
        required: data.required,
        visibleInPdf: data.visibleInPdf,
        sortOrder: data.sortOrder,
      })
      .where(and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.organizationId, ctx.organizationId)))
      .returning();
    if (!row) throw notFound("El campo");
    return row;
  });
}

export async function archiveCustomField(ctx: TenantContext, id: string, archived = true) {
  assertCan(ctx, "customFields.manage");
  assertUuid(id, "El campo");
  await withTenant(ctx, async (tx) => {
    const res = await tx
      .update(customFieldDefinitions)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(customFieldDefinitions.id, id), eq(customFieldDefinitions.organizationId, ctx.organizationId)))
      .returning({ id: customFieldDefinitions.id });
    if (!res.length) throw notFound("El campo");
  });
}

/** Valida y normaliza un valor según su definición. Nunca ejecuta código. */
export function normalizeCustomValue(def: CustomFieldDefinitionSnapshot, raw: unknown): CustomValue {
  if (raw === undefined || raw === null || raw === "") return null;
  switch (def.type) {
    case "short_text": {
      const s = String(raw).trim();
      if (s.length > 300) throw validation(`${def.label}: máximo 300 caracteres`);
      return s || null;
    }
    case "long_text": {
      const s = String(raw).trim();
      if (s.length > 5000) throw validation(`${def.label}: máximo 5000 caracteres`);
      return s || null;
    }
    case "number": {
      const s = String(raw).trim().replace(/,/g, "");
      if (!/^-?\d+(\.\d+)?$/.test(s) || s.length > 30) throw validation(`${def.label}: número inválido`);
      return s;
    }
    case "date": {
      const s = String(raw);
      if (!isIsoDate(s)) throw validation(`${def.label}: fecha inválida`);
      return s;
    }
    case "select": {
      const s = String(raw);
      if (!def.options.includes(s)) throw validation(`${def.label}: opción no válida`);
      return s;
    }
    case "checkbox":
      return raw === true || raw === "true" || raw === "on";
  }
}
