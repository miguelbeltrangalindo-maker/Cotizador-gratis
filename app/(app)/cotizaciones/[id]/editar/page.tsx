import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { getEditorData } from "@/features/quotes/service";
import { listBrands } from "@/features/brands/service";
import { notFound } from "next/navigation";
import { QuoteEditor } from "@/components/domain/quote-editor/editor";

export const metadata: Metadata = { title: "Editar cotización" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireTenant();
  const data = await getEditorData(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  if (data.version.status !== "DRAFT") redirect(`/cotizaciones/${id}`);
  const brands = await listBrands(ctx);
  return (
    <QuoteEditor
      quoteId={data.quote.id}
      versionId={data.version.id}
      initialRevision={data.version.revision}
      initialDraft={data.draft}
      folio={data.quote.folio}
      versionNumber={data.version.versionNumber}
      brands={brands
        .filter((b) => b.isActive || b.id === data.quote.brandId)
        .map((b) => ({
          id: b.id,
          name: b.name,
          defaultTaxMode: b.defaultTaxMode as "NONE" | "EXCLUSIVE" | "INCLUSIVE",
          defaultTaxRate: b.defaultTaxRate,
          pdfTemplate: b.pdfTemplate,
          paperSize: b.paperSize,
        }))}
      customDefs={data.customDefs}
      initialClient={
        data.client ? { id: data.client.id, name: data.client.name, email: data.client.email, taxId: data.client.taxId, businessName: null, preferredCurrency: null } : null
      }
      hasReceipts={data.hasReceipts}
    />
  );
}
