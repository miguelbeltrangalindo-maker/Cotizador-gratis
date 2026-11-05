"use server";

import { revalidatePath } from "next/cache";
import { formString, runAction } from "@/lib/action";
import type { ActionResult } from "@/lib/errors";
import { requireTenant } from "@/lib/session";
import { archiveCatalogItem, createCatalogItem, listCatalogItems, updateCatalogItem, type CatalogInput } from "./service";

function fromForm(fd: FormData): CatalogInput {
  return {
    title: formString(fd, "title"),
    description: formString(fd, "description"),
    unit: formString(fd, "unit"),
    suggestedPrice: formString(fd, "suggestedPrice") || "0",
    currency: formString(fd, "currency") as CatalogInput["currency"],
    taxMode: formString(fd, "taxMode") as CatalogInput["taxMode"],
    taxRate: formString(fd, "taxRate") || "0",
    brandId: formString(fd, "brandId") || null,
  };
}

export async function saveCatalogItemAction(id: string | null, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    const input = fromForm(fd);
    if (id) await updateCatalogItem(ctx, id, input);
    else await createCatalogItem(ctx, input);
    revalidatePath("/catalogo");
  });
}

export async function archiveCatalogItemAction(id: string, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await archiveCatalogItem(ctx, id, archived);
    revalidatePath("/catalogo");
  });
}

export async function searchCatalogAction(q: string) {
  const { ctx } = await requireTenant();
  const { rows } = await listCatalogItems(ctx, { q, pageSize: 15 });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    unit: r.unit,
    suggestedPrice: r.suggestedPrice,
    currency: r.currency,
    taxMode: r.taxMode,
    taxRate: r.taxRate,
  }));
}

/** "Guardar este concepto en catálogo" desde el editor. */
export async function saveLineToCatalogAction(input: CatalogInput) {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    const r = await createCatalogItem(ctx, input);
    revalidatePath("/catalogo");
    return { id: r.id };
  });
}
