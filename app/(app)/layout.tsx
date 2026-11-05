import type { ReactNode } from "react";
import Link from "next/link";
import { requireTenant } from "@/lib/session";
import { AppMark } from "@/components/domain/app-mark";
import { BottomNav, SidebarNav } from "@/components/domain/nav";
import { OrgSwitcher } from "@/components/domain/org-switcher";
import { logoutAction } from "@/features/auth/actions";
import { ROLE_LABEL } from "@/lib/security/tenant";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { session, organizations, activeOrganization } = await requireTenant();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Escritorio: barra lateral */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface-muted p-5 lg:flex">
        <Link href="/inicio" aria-label="Inicio">
          <AppMark />
        </Link>
        <OrgSwitcher organizations={organizations} activeId={activeOrganization.id} />
        <SidebarNav />
        <div className="mt-auto flex flex-col gap-1 text-sm">
          <p className="truncate font-medium" title={session.email}>
            {session.name}
          </p>
          <p className="text-muted">{ROLE_LABEL[activeOrganization.role]}</p>
          <form action={logoutAction}>
            <button type="submit" className="min-h-11 text-left text-link hover:underline">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Móvil: encabezado superior */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur lg:hidden"
          style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}
        >
          <Link href="/inicio" aria-label="Inicio">
            <AppMark size={28} />
          </Link>
          <Link href="/ajustes/organizacion" className="max-w-[50%] truncate rounded-lg px-2 py-2 text-sm text-muted" title={activeOrganization.name}>
            {activeOrganization.name}
          </Link>
        </header>
        <main className="pb-safe-nav mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 lg:pt-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
