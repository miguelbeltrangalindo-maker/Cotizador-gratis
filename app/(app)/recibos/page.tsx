import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireTenant } from "@/lib/session";
import { listReceipts, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/features/receipts/service";
import { formatMoney } from "@/lib/money";
import { formatInstant } from "@/lib/utils/dates";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { ReceiptStatusChip } from "@/components/domain/status";
import { FilterSelect, SearchBox } from "@/components/domain/search-box";

export const metadata: Metadata = { title: "Recibos" };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; pagina?: string }> }) {
  const { ctx } = await requireTenant();
  const sp = await searchParams;
  const status = sp.estado === "ISSUED" || sp.estado === "VOID" ? sp.estado : "ALL";
  const data = await listReceipts(ctx, { q: sp.q, status, page: Number(sp.pagina) || 1 });
  const hrefFor = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("pagina", String(p));
    return `/recibos?${u.toString()}`;
  };
  return (
    <div>
      <PageHeader title="Recibos" subtitle={`${data.issued} recibo${data.issued === 1 ? "" : "s"} emitido${data.issued === 1 ? "" : "s"}`} actions={<ButtonLink href="/recibos/nuevo">Nuevo recibo</ButtonLink>} />
      <div className="card mb-4 flex flex-col gap-3 p-4">
        <Suspense>
          <SearchBox placeholder="Buscar cliente, folio, método, referencia o cotización…" label="Buscar recibos" />
          <div className="flex gap-3">
            <FilterSelect
              param="estado"
              label="Estado"
              options={[
                { value: "", label: "Todos" },
                { value: "ISSUED", label: "Emitidos" },
                { value: "VOID", label: "Anulados" },
              ]}
            />
          </div>
        </Suspense>
      </div>
      {data.rows.length === 0 ? (
        <EmptyState
          title={sp.q || sp.estado ? "Sin resultados" : "Aún no tienes recibos"}
          description="Emite un recibo independiente o regístralo desde una cotización enviada."
          action={<ButtonLink href="/recibos/nuevo">Nuevo recibo</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.rows.map((r) => (
            <li key={r.id}>
              <Link href={`/recibos/${r.id}`} className="card block p-4 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-link">{r.folio}</p>
                    <p className="break-anywhere font-medium">{r.payerName}</p>
                  </div>
                  <ReceiptStatusChip status={r.status} />
                </div>
                <p className="mt-1 line-clamp-1 break-anywhere text-sm text-muted">{r.concept}</p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                  <span className="text-sm text-muted">
                    {formatInstant(r.receivedAt, ctx.timezone, false)} · {PAYMENT_METHOD_LABEL[r.paymentMethod as PaymentMethod]}
                    {r.paymentReference ? ` · ${r.paymentReference}` : ""}
                    {r.quoteFolio ? ` · ${r.quoteFolio}` : ""}
                  </span>
                  <span className={`text-lg font-semibold whitespace-nowrap ${r.status === "VOID" ? "text-muted line-through" : ""}`}>{formatMoney(r.amountMinor, r.currency)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={hrefFor} />
    </div>
  );
}
