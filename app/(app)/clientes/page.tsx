import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireTenant } from "@/lib/session";
import { listClients } from "@/features/clients/service";
import { ButtonLink } from "@/components/ui/button";
import { Chip, EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { FilterSelect, SearchBox } from "@/components/domain/search-box";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; archivados?: string; pagina?: string }> }) {
  const { ctx } = await requireTenant();
  const sp = await searchParams;
  const data = await listClients(ctx, { q: sp.q, archived: sp.archivados === "1", page: Number(sp.pagina) || 1 });
  const hrefFor = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("pagina", String(p));
    return `/clientes?${u.toString()}`;
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Clientes" subtitle={`${data.total} cliente${data.total === 1 ? "" : "s"}`} actions={<ButtonLink href="/clientes/nuevo">Nuevo cliente</ButtonLink>} />
      <div className="card mb-4 flex flex-col gap-3 p-4">
        <Suspense>
          <SearchBox placeholder="Buscar por nombre, RFC, correo o contacto…" label="Buscar clientes" />
          <div className="flex">
            <FilterSelect param="archivados" label="Mostrar" options={[{ value: "", label: "Activos" }, { value: "1", label: "Archivados" }]} />
          </div>
        </Suspense>
      </div>
      {data.rows.length === 0 ? (
        <EmptyState title={sp.q ? "Sin resultados" : "Aún no tienes clientes"} description="Los clientes también se pueden crear desde el editor de cotizaciones." action={<ButtonLink href="/clientes/nuevo">Agregar cliente</ButtonLink>} />
      ) : (
        <ul className="card divide-y divide-border">
          {data.rows.map((c) => (
            <li key={c.id}>
              <Link href={`/clientes/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-muted">
                <span className="min-w-0">
                  <span className="block break-anywhere font-medium">{c.name}</span>
                  <span className="block break-anywhere text-sm text-muted">{[c.businessName, c.taxId, c.email, c.phone].filter(Boolean).join(" · ") || "Sin datos adicionales"}</span>
                </span>
                {c.archivedAt ? <Chip tone="warning">Archivado</Chip> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={hrefFor} />
    </div>
  );
}
