import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { getQuoteDetail } from "@/features/quotes/service";
import { PdfPreview } from "@/components/domain/pdf-preview";

export const metadata: Metadata = { title: "Vista previa" };

export default async function QuotePreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx } = await requireTenant();
  const d = await getQuoteDetail(ctx, id, sp.v ? Number(sp.v) : undefined).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const url = `/api/quotes/${d.quote.id}/pdf?v=${d.version.versionNumber}`;
  return (
    <PdfPreview
      title={`${d.quote.folio ?? "Borrador"} · V${d.version.versionNumber}`}
      back={{ href: `/cotizaciones/${d.quote.id}?v=${d.version.versionNumber}`, label: "Volver a la cotización" }}
      src={url}
      draft={d.version.status === "DRAFT"}
    />
  );
}
