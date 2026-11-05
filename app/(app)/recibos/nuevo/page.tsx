import type { Metadata } from "next";
import { requireTenant } from "@/lib/session";
import { listBrands } from "@/features/brands/service";
import { getReceiptPrefillFromQuote } from "@/features/receipts/service";
import { isUuid } from "@/lib/security/tenant";
import { toDateTimeLocalValue } from "@/lib/utils/dates";
import { AppError } from "@/lib/errors";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { ReceiptForm } from "./receipt-form";

export const metadata: Metadata = { title: "Nuevo recibo" };

export default async function NewReceiptPage({ searchParams }: { searchParams: Promise<{ cotizacion?: string }> }) {
  const { ctx } = await requireTenant();
  const sp = await searchParams;
  const brands = await listBrands(ctx, { activeOnly: true });
  let prefill = null;
  let prefillError: string | null = null;
  if (sp.cotizacion && isUuid(sp.cotizacion)) {
    try {
      prefill = await getReceiptPrefillFromQuote(ctx, sp.cotizacion);
    } catch (e) {
      prefillError = e instanceof AppError ? e.message : "No fue posible cargar la cotización.";
    }
  }
  if (brands.length === 0) {
    return <EmptyState title="Necesitas una marca activa" action={<ButtonLink href="/ajustes/marcas/nueva">Crear marca</ButtonLink>} />;
  }
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: prefill ? `/cotizaciones/${prefill.quoteId}` : "/recibos", label: prefill ? "Cotización" : "Recibos" }} title="Nuevo recibo" subtitle="Constancia comercial de pago. No es una factura (CFDI)." />
      {prefillError ? (
        <div className="mb-4">
          <Alert tone="danger">{prefillError}</Alert>
        </div>
      ) : null}
      <ReceiptForm
        brands={brands.map((b) => ({ id: b.id, name: b.name, currency: b.defaultCurrency, signatureName: b.signatureName }))}
        prefill={prefill}
        defaultReceivedAt={toDateTimeLocalValue(new Date(), ctx.timezone)}
      />
    </div>
  );
}
