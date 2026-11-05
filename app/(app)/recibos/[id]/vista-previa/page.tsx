import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { getReceipt } from "@/features/receipts/service";
import { PdfPreview } from "@/components/domain/pdf-preview";

export const metadata: Metadata = { title: "Vista previa de recibo" };

export default async function ReceiptPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireTenant();
  const { receipt } = await getReceipt(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return <PdfPreview title={receipt.folio} back={{ href: `/recibos/${receipt.id}`, label: "Volver al recibo" }} src={`/api/receipts/${receipt.id}/pdf`} />;
}
