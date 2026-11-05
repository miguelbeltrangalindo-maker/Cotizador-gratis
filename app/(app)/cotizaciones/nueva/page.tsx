import type { Metadata } from "next";
import { requireTenant } from "@/lib/session";
import { listBrands } from "@/features/brands/service";
import { getClient } from "@/features/clients/service";
import { isUuid } from "@/lib/security/tenant";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { NewQuoteForm } from "./new-quote-form";

export const metadata: Metadata = { title: "Nueva cotización" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { ctx } = await requireTenant();
  const sp = await searchParams;
  const brands = await listBrands(ctx, { activeOnly: true });
  const client = sp.cliente && isUuid(sp.cliente) ? await getClient(ctx, sp.cliente).catch(() => null) : null;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Nueva cotización" subtitle="Elige cliente y marca. Después agregas los conceptos." />
      {brands.length === 0 ? (
        <EmptyState
          title="Necesitas una marca activa"
          description="La marca define el logo, colores y folios de tus documentos."
          action={<ButtonLink href="/ajustes/marcas/nueva">Crear marca</ButtonLink>}
        />
      ) : (
        <NewQuoteForm
          brands={brands.map((b) => ({ id: b.id, name: b.name }))}
          initialClient={client ? { id: client.id, name: client.name, businessName: client.businessName, taxId: client.taxId, email: client.email, preferredCurrency: client.preferredCurrency } : null}
        />
      )}
    </div>
  );
}
