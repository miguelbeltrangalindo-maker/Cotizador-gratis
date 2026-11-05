"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import type { ActionResult } from "@/lib/errors";
import { requireTenant } from "@/lib/session";
import { listPayableQuotes } from "@/features/quotes/service";
import { fromDateTimeLocalValue } from "@/lib/utils/dates";
import { AppError } from "@/lib/errors";
import { issueReceipt, voidReceipt, type ReceiptInput } from "./service";

export async function issueReceiptAction(input: Omit<ReceiptInput, "receivedAt"> & { receivedAtLocal: string }): Promise<ActionResult<{ id: string; duplicated: boolean }>> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    let receivedAt: Date;
    try {
      receivedAt = fromDateTimeLocalValue(input.receivedAtLocal, ctx.timezone);
    } catch {
      throw new AppError("VALIDATION_ERROR", "Fecha y hora de recepción inválidas.", { receivedAt: "Fecha inválida" });
    }
    const { receivedAtLocal: _ignored, ...rest } = input;
    void _ignored;
    const { receipt, duplicated } = await issueReceipt(ctx, { ...rest, receivedAt });
    revalidatePath("/recibos");
    if (receipt.quoteId) revalidatePath(`/cotizaciones/${receipt.quoteId}`);
    return { id: receipt.id, duplicated };
  });
}

export async function voidReceiptAction(receiptId: string, reason: string): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await voidReceipt(ctx, receiptId, reason);
    revalidatePath(`/recibos/${receiptId}`);
    revalidatePath("/recibos");
  });
}

export async function searchPayableQuotesAction(q: string) {
  const { ctx } = await requireTenant();
  return listPayableQuotes(ctx, q);
}
