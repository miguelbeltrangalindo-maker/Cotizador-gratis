import type { Metadata } from "next";
import { Suspense } from "react";
import { requireTenant } from "@/lib/session";
import { can } from "@/lib/security/tenant";
import { listCatalogItems } from "@/features/catalog/service";
import { listBrands } from "@/features/brands/service";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { FilterSelect, SearchBox } from "@/components/domain/search-box";
import { CatalogManager } from "./catalog-manager";

export const metadata: Metadata = { title: "Servicios y productos" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; archivados?: string; pagina?: string }> }) {
  const { ctx } = await requireTenant();
  const sp = await searchParams;
  const [data, brands] = await Promise.all([listCatalogItems(ctx, { q: sp.q, archived: sp.archivados === "1", page: Number(sp.pagina) || 1 }), listBrands(ctx)]);
  const hrefFor = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("pagina", String(p));
    return `/catalogo?${u.toString()}`;
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Servicios y productos" subtitle="Conceptos reutilizables. Al insertarlos en una cotización puedes editarlos sin cambiar el catálogo." />
      <div className="card mb-4 flex flex-col gap-3 p-4">
        <Suspense>
          <SearchBox placeholder="Buscar concepto…" label="Buscar en catálogo" />
          <div className="flex">
            <FilterSelect param="archivados" label="Mostrar" options={[{ value: "", label: "Activos" }, { value: "1", label: "Archivados" }]} />
          </div>
        </Suspense>
      </div>
      <CatalogManager
        rows={data.rows.map((r) => ({ ...r, archived: Boolean(r.archivedAt) }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        canManage={can(ctx.role, "catalog.manage")}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={hrefFor} />
    </div>
  );
}
