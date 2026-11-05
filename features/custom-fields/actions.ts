"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import type { ActionResult } from "@/lib/errors";
import { requireTenant } from "@/lib/session";
import { archiveCustomField, createCustomField, updateCustomField, type CustomFieldType } from "./service";

export interface CustomFieldForm {
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  visibleInPdf: boolean;
  sortOrder: number;
}

export async function saveCustomFieldAction(id: string | null, input: CustomFieldForm): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    if (id) await updateCustomField(ctx, id, input);
    else await createCustomField(ctx, input);
    revalidatePath("/ajustes/campos");
  });
}

export async function archiveCustomFieldAction(id: string, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await archiveCustomField(ctx, id, archived);
    revalidatePath("/ajustes/campos");
  });
}
