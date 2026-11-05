import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/session";
import { can } from "@/lib/security/tenant";
import { getOrganization } from "@/features/organizations/service";
import { Card, PageHeader } from "@/components/ui/misc";
import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = { title: "Organización" };

export default async function OrganizationPage() {
  const { ctx } = await requireTenant();
  const org = await getOrganization(ctx);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: "/ajustes", label: "Ajustes" }} title="Organización" />
      <OrganizationForm org={{ name: org.name, timezone: org.timezone, defaultCurrency: org.defaultCurrency, country: org.country }} canEdit={can(ctx.role, "org.manage")} />
      <Card className="mt-5">
        <p className="text-sm text-muted">
          ¿Necesitas separar otra empresa con datos independientes?{" "}
          <Link href="/bienvenida?nueva=1" className="text-link underline">
            Crear otra organización
          </Link>
          . Nunca se mezclan datos entre organizaciones.
        </p>
        <p className="mt-2 text-sm text-muted">Plan actual: Gratuito (sin límites activos en esta versión).</p>
      </Card>
    </div>
  );
}
