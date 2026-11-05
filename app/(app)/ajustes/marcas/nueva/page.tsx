import type { Metadata } from "next";
import { requireTenant } from "@/lib/session";
import { assertCan } from "@/lib/security/tenant";
import { getOrganization } from "@/features/organizations/service";
import { PageHeader } from "@/components/ui/misc";
import { BrandForm } from "../brand-form";

export const metadata: Metadata = { title: "Nueva marca" };

export default async function NewBrandPage() {
  const { ctx } = await requireTenant();
  assertCan(ctx, "brands.manage");
  const org = await getOrganization(ctx);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader back={{ href: "/ajustes/marcas", label: "Marcas" }} title="Nueva marca" />
      <BrandForm brand={null} defaultCurrency={org.defaultCurrency as "MXN" | "USD"} />
    </div>
  );
}
