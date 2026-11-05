"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString, runAction } from "@/lib/action";
import type { ActionResult } from "@/lib/errors";
import { requireTenant } from "@/lib/session";
import type { DraftInput } from "./schema";
import {
  archiveQuote,
  changeQuoteStatus,
  createQuote,
  createQuoteVersion,
  duplicateQuote,
  saveDraft,
  type SaveDraftResult,
} from "./service";
import type { QuoteStatus } from "./status";

export async function createQuoteAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await runAction(async () => {
    const { ctx } = await requireTenant();
    return createQuote(ctx, {
      brandId: formString(fd, "brandId") || null,
      clientId: formString(fd, "clientId") || null,
    });
  });
  if (res.ok) redirect(`/cotizaciones/${res.data.quoteId}/editar`);
  return res;
}

export async function saveDraftAction(
  quoteId: string,
  versionId: string,
  revision: number,
  draft: DraftInput,
): Promise<ActionResult<SaveDraftResult>> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    return saveDraft(ctx, quoteId, versionId, revision, draft);
  });
}

export async function changeQuoteStatusAction(quoteId: string, to: QuoteStatus): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await changeQuoteStatus(ctx, quoteId, to);
    revalidatePath(`/cotizaciones/${quoteId}`);
  });
}

export async function createQuoteVersionAction(quoteId: string): Promise<ActionResult> {
  const res = await runAction(async () => {
    const { ctx } = await requireTenant();
    return createQuoteVersion(ctx, quoteId);
  });
  if (res.ok) redirect(`/cotizaciones/${quoteId}/editar`);
  return res;
}

export async function duplicateQuoteAction(quoteId: string, versionNumber?: number): Promise<ActionResult> {
  const res = await runAction(async () => {
    const { ctx } = await requireTenant();
    return duplicateQuote(ctx, quoteId, versionNumber);
  });
  if (res.ok) redirect(`/cotizaciones/${res.data.quoteId}/editar`);
  return res;
}

export async function archiveQuoteAction(quoteId: string, archived: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const { ctx } = await requireTenant();
    await archiveQuote(ctx, quoteId, archived);
    revalidatePath(`/cotizaciones/${quoteId}`);
    revalidatePath("/cotizaciones");
  });
}
