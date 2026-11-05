import type { Metadata } from "next";
import { Suspense } from "react";
import { requireTenant } from "@/lib/session";
import { listQuotes } from "@/features/quotes/service";
import { listBrands } from "@/features/brands/service";
import { QUOTE_STATUSES, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/features/quotes/status";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { QuoteCard } from "@/components/domain/quote-card";
import { FilterSelect, SearchBox } from "@/components/domain/search-box";

export const metadata: Metadata = { title: "Historial de cotizaciones" };

type SP = { q?: string; estado?: string; marca?: string; moneda?: string; archivadas?: string; pagina?: string };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { ctx } = await requireTenant();
  const sp = await searchParams;
  const status = QUOTE_STATUSES.includes(sp.estado as QuoteStatus) ? (sp.estado as QuoteStatus) : "ALL";
  const [data, brands] = await Promise.all([
    listQuotes(ctx, {
      q: sp.q,
      status,
      brandId: sp.marca || undefined,
      currency: sp.moneda,
      archived: sp.archivadas === "1",
      page: Number(sp.pagina) || 1,
    }),
    listBrands(ctx),
  ]);
  const hrefFor = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("pagina", String(p));
    return `/cotizaciones?${u.toString()}`;
  };
  const filtered = Boolean(sp.q || sp.estado || sp.marca || sp.moneda || sp.archivadas);
  return (
    <div>
      <PageHeader
        title="Historial"
        subtitle={`${data.total} cotización${data.total === 1 ? "" : "es"}${filtered ? " con estos filtros" : ""}`}
        actions={<ButtonLink href="/cotizaciones/nueva">Nueva cotización</ButtonLink>}
      />
      <div className="card mb-4 flex flex-col gap-3 p-4">
        <Suspense>
          <SearchBox placeholder="Buscar cliente, folio o servicio…" label="Buscar cotizaciones" />
          <div className="flex flex-wrap gap-3">
            <FilterSelect
              param="estado"
              label="Estado"
              options={[{ value: "", label: "Todos" }, ...QUOTE_STATUSES.map((s) => ({ value: s, label: QUOTE_STATUS_LABEL[s] }))]}
            />
            <FilterSelect
              param="moneda"
              label="Moneda"
              options={[
                { value: "", label: "Todas" },
                { value: "MXN", label: "MXN" },
                { value: "USD", label: "USD" },
              ]}
            />
            {brands.length > 1 ? (
              <FilterSelect param="marca" label="Marca" options={[{ value: "", label: "Todas" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]} />
            ) : null}
            <FilterSelect
              param="archivadas"
              label="Mostrar"
              options={[
                { value: "", label: "Activas" },
                { value: "1", label: "Archivadas" },
              ]}
            />
          </div>
        </Suspense>
      </div>
      {data.rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Sin resultados" : "Aún no tienes cotizaciones"}
          description={filtered ? "Prueba con otra búsqueda o quita filtros." : "Crea tu primera cotización en minutos."}
          action={filtered ? undefined : <ButtonLink href="/cotizaciones/nueva">Crear cotización</ButtonLink>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.rows.map((q) => (
            <QuoteCard key={q.id} q={q} timezone={ctx.timezone} />
          ))}
        </div>
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={hrefFor} />
    </div>
  );
}
