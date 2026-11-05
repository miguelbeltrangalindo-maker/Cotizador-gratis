"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { AppError, type ActionResult } from "@/lib/errors";
import { requireTenant } from "@/lib/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { MAX_LOGO_BYTES } from "@/lib/storage/image";
import { createBrand, removeBrandLogo, updateBrand, uploadBrandLogo, type BrandInput } from "./service";

export async function saveBrandAction(brandId: string | null, input: BrandInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    const b = brandId ? await updateBrand(ctx, brandId, input) : await createBrand(ctx, input);
    revalidatePath("/ajustes/marcas");
    return { id: b.id };
  });
}

export async function uploadLogoAction(brandId: string, fd: FormData): Promise<ActionResult<{ fileId: string }>> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await enforceRateLimit(`upload:${ctx.userId}`, 30, 60 * 60);
    const file = fd.get("logo");
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Selecciona un archivo de imagen.");
    if (file.size > MAX_LOGO_BYTES) throw new AppError("VALIDATION_ERROR", "El logo debe pesar como máximo 5 MB.");
    const buf = Buffer.from(await file.arrayBuffer());
    const res = await uploadBrandLogo(ctx, brandId, buf);
    revalidatePath(`/ajustes/marcas/${brandId}`);
    return res;
  });
}

export async function removeLogoAction(brandId: string): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await removeBrandLogo(ctx, brandId);
    revalidatePath(`/ajustes/marcas/${brandId}`);
  });
}
