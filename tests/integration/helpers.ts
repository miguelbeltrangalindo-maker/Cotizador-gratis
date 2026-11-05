import { randomUUID } from "node:crypto";
import { registerUser } from "@/features/auth/service";
import { assertOrganizationMember, createOrganization } from "@/features/organizations/service";
import { createBrand } from "@/features/brands/service";
import { createClient } from "@/features/clients/service";
import { changeQuoteStatus, createQuote, getEditorData, saveDraft } from "@/features/quotes/service";
import type { DraftItem } from "@/features/quotes/schema";
import type { TenantContext } from "@/lib/security/tenant";

let n = 0;
export async function setupTenant(label: string, opts: { currency?: "MXN" | "USD"; prefix?: string } = {}) {
  n += 1;
  const user = await registerUser({ name: `Usuario ${label}`, email: `${label.toLowerCase()}-${n}-${randomUUID().slice(0, 6)}@test.local`, password: "Prueba-12345" });
  const org = await createOrganization(user.id, { name: `Org ${label}` });
  const ctx = await assertOrganizationMember(user.id, org.id);
  const brand = await createBrand(ctx, { name: `Marca ${label}`, quotePrefix: opts.prefix ?? label.slice(0, 3).toUpperCase(), receiptPrefix: "REC", defaultCurrency: opts.currency ?? "MXN" });
  const client = await createClient(ctx, { name: `Cliente ${label}` });
  return { user, ctx, brand, client };
}

export function item(description: string, quantity: string, unitPrice: string, extra: Partial<DraftItem> = {}): DraftItem {
  return {
    id: randomUUID(),
    groupId: null,
    description,
    unit: null,
    quantity,
    unitPrice,
    discountType: "NONE",
    discountValue: "0",
    taxMode: "NONE",
    taxRate: "0",
    hideUnitPriceInPdf: false,
    ...extra,
  };
}

export async function makeQuote(
  ctx: TenantContext,
  brandId: string,
  clientId: string | null,
  items: DraftItem[],
  opts: { currency?: "MXN" | "USD"; send?: boolean; approve?: boolean; title?: string } = {},
) {
  const q = await createQuote(ctx, { brandId, clientId });
  const e = await getEditorData(ctx, q.quoteId);
  await saveDraft(ctx, q.quoteId, e.version.id, e.version.revision, { ...e.draft, currency: opts.currency ?? "MXN", items, title: opts.title ?? "Prueba" });
  if (opts.send || opts.approve) await changeQuoteStatus(ctx, q.quoteId, "SENT");
  if (opts.approve) await changeQuoteStatus(ctx, q.quoteId, "APPROVED");
  return q.quoteId;
}
