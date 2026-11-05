import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/session";
import { can } from "@/lib/security/tenant";
import { listBrands } from "@/features/brands/service";
import { PDF_TEMPLATE_LABEL, type PdfTemplate } from "@/features/brands/constants";
import { ButtonLink } from "@/components/ui/button";
import { Chip, PageHeader } from "@/components/ui/misc";
import { BrandAvatar } from "@/components/domain/brand-avatar";

export const metadata: Metadata = { title: "Marcas" };

export default async function BrandsPage() {
  const { ctx } = await requireTenant();
  const brands = await listBrands(ctx);
  const manage = can(ctx.role, "brands.manage");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/ajustes", label: "Ajustes" }}
        title="Marcas"
        subtitle="Cada marca tiene su logo, colores, datos y folios. Cambiar una marca no altera documentos ya emitidos."
        actions={manage ? <ButtonLink href="/ajustes/marcas/nueva">Nueva marca</ButtonLink> : null}
      />
      <ul className="grid gap-3">
        {brands.map((b) => (
          <li key={b.id}>
            <Link href={`/ajustes/marcas/${b.id}`} className="card flex items-center gap-4 p-4 hover:shadow-md">
              <BrandAvatar name={b.name} color={b.colorPrimary} logoFileId={b.logoFileId} />
              <div className="min-w-0 flex-1">
                <p className="break-anywhere font-semibold">{b.name}</p>
                <p className="text-sm text-muted">
                  Folios {b.quotePrefix} / {b.receiptPrefix} · {b.defaultCurrency} · {PDF_TEMPLATE_LABEL[b.pdfTemplate as PdfTemplate]}
                </p>
              </div>
              {!b.isActive ? <Chip tone="warning">Inactiva</Chip> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
