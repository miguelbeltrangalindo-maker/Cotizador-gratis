import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/security/tenant";
import { getBrand } from "@/features/brands/service";
import { Alert, PageHeader } from "@/components/ui/misc";
import { BrandForm } from "../brand-form";

export const metadata: Metadata = { title: "Editar marca" };

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireTenant();
  const brand = await getBrand(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader back={{ href: "/ajustes/marcas", label: "Marcas" }} title={brand.name} />
      {!can(ctx.role, "brands.manage") ? (
        <Alert tone="info">Tu rol permite ver la marca pero no modificarla.</Alert>
      ) : (
        <BrandForm brand={brand} defaultCurrency={brand.defaultCurrency as "MXN" | "USD"} />
      )}
    </div>
  );
}
