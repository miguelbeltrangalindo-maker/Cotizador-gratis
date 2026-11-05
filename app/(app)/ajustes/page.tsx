import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Building2, Palette, Users, Package, LayoutTemplate, ListPlus, UserCog, Download, UserRound } from "lucide-react";
import { requireTenant } from "@/lib/session";
import { can, ROLE_LABEL } from "@/lib/security/tenant";
import { logoutAction } from "@/features/auth/actions";
import { PageHeader } from "@/components/ui/misc";
import { OrgSwitcher } from "@/components/domain/org-switcher";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const { ctx, session, organizations, activeOrganization } = await requireTenant();
  const items = [
    { href: "/ajustes/perfil", label: "Mi perfil", desc: `${session.name} · ${session.email}`, icon: UserRound, show: true },
    { href: "/ajustes/organizacion", label: "Organización", desc: `${activeOrganization.name} · ${ROLE_LABEL[activeOrganization.role]}`, icon: Building2, show: true },
    { href: "/ajustes/marcas", label: "Marcas", desc: "Logo, colores, folios, impuestos y pie de página", icon: Palette, show: true },
    { href: "/clientes", label: "Clientes", desc: "Catálogo de clientes y archivado", icon: Users, show: true },
    { href: "/catalogo", label: "Servicios y productos", desc: "Conceptos reutilizables", icon: Package, show: true },
    { href: "/ajustes/plantillas", label: "Plantillas", desc: "Minimal, Corporativo y Creativo", icon: LayoutTemplate, show: true },
    { href: "/ajustes/campos", label: "Campos personalizados", desc: "Información adicional en cotizaciones", icon: ListPlus, show: can(ctx.role, "customFields.manage") },
    { href: "/ajustes/miembros", label: "Usuarios y permisos", desc: "Integrantes y roles", icon: UserCog, show: true },
    { href: "/ajustes/datos", label: "Datos", desc: "Exportar CSV de clientes, cotizaciones y recibos", icon: Download, show: can(ctx.role, "data.export") },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajustes" />
      <div className="mb-4 lg:hidden">
        <OrgSwitcher organizations={organizations} activeId={activeOrganization.id} />
      </div>
      <ul className="card divide-y divide-border">
        {items
          .filter((i) => i.show)
          .map((i) => {
            const Icon = i.icon;
            return (
              <li key={i.href}>
                <Link href={i.href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                  <Icon size={22} className="shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{i.label}</span>
                    <span className="block truncate text-sm text-muted">{i.desc}</span>
                  </span>
                  <ChevronRight size={18} className="text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
      </ul>
      <form action={logoutAction} className="mt-6">
        <button type="submit" className="min-h-11 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface font-medium text-danger">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
