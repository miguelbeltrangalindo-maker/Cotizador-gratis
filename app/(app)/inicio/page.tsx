import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, UserPlus } from "lucide-react";
import { requireTenant } from "@/lib/session";
import { getDashboard, listQuotes } from "@/features/quotes/service";
import { listReceipts } from "@/features/receipts/service";
import { formatMoney } from "@/lib/money";
import { formatInstant } from "@/lib/utils/dates";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "@/features/quotes/status";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, EmptyState } from "@/components/ui/misc";
import { QuoteCard } from "@/components/domain/quote-card";
import { ReceiptStatusChip } from "@/components/domain/status";

export const metadata: Metadata = { title: "Inicio" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const { ctx, session, activeOrganization } = await requireTenant();
  const sp = await searchParams;
  const [dash, recent, receipts] = await Promise.all([
    getDashboard(ctx),
    listQuotes(ctx, { pageSize: 5 }),
    listReceipts(ctx, { pageSize: 5 }),
  ]);
  const statuses: QuoteStatus[] = ["DRAFT", "SENT", "APPROVED"];
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-muted">{activeOrganization.name}</p>
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-3xl">Hola, {session.name.split(" ")[0]}</h1>
      </header>
      {sp.bienvenida ? (
        <Alert tone="success" title="¡Tu empresa está lista!">
          Crea tu primera cotización o agrega un cliente. Puedes subir tu logo en Ajustes → Marcas.
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/cotizaciones/nueva" size="lg" className="w-full">
          <FilePlus2 size={20} aria-hidden /> {recent.total === 0 ? "Crear primera cotización" : "Nueva cotización"}
        </ButtonLink>
        <ButtonLink href="/clientes/nuevo" size="lg" variant="secondary" className="w-full">
          <UserPlus size={20} aria-hidden /> Agregar cliente
        </ButtonLink>
      </div>

      <section aria-labelledby="resumen" className="grid gap-3 sm:grid-cols-3">
        <h2 id="resumen" className="sr-only">
          Resumen
        </h2>
        {statuses.map((s) => (
          <Link key={s} href={`/cotizaciones?estado=${s}`} className="card p-4 hover:ring-1 hover:ring-border-strong">
            <p className="text-sm text-muted">{QUOTE_STATUS_LABEL[s]}s</p>
            <p className="text-3xl font-semibold">{dash.statusCounts[s] ?? 0}</p>
          </Link>
        ))}
      </section>

      <Card>
        <h2 className="text-lg font-semibold">Pendiente de cobro</h2>
        <p className="text-sm text-muted">Cotizaciones enviadas o aprobadas menos recibos activos. Cada moneda por separado.</p>
        {dash.pending.length === 0 ? (
          <p className="mt-3 text-muted">Sin saldos pendientes.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {dash.pending.map((p) => (
              <li key={p.currency} className="rounded-[var(--radius-sm)] bg-surface-muted p-3">
                <p className="text-2xl font-semibold">{formatMoney(p.pendingMinor, p.currency)}</p>
                <p className="text-sm text-muted">{p.quotesCount} cotización(es) con saldo</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cotizaciones recientes</h2>
          <Link href="/cotizaciones" className="min-h-11 content-center text-sm text-link hover:underline">
            Ver historial
          </Link>
        </div>
        {recent.rows.length === 0 ? (
          <EmptyState title="Aún no tienes cotizaciones" description="Crea la primera en menos de un minuto." />
        ) : (
          recent.rows.map((q) => <QuoteCard key={q.id} q={q} timezone={ctx.timezone} />)
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recibos recientes</h2>
          <Link href="/recibos" className="min-h-11 content-center text-sm text-link hover:underline">
            Ver recibos
          </Link>
        </div>
        {receipts.rows.length === 0 ? (
          <p className="text-muted">Sin recibos todavía.</p>
        ) : (
          <ul className="card divide-y divide-border">
            {receipts.rows.map((r) => (
              <li key={r.id}>
                <Link href={`/recibos/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-muted">
                  <span className="min-w-0">
                    <span className="font-semibold text-link">{r.folio}</span>{" "}
                    <span className="break-anywhere text-muted">· {r.payerName}</span>
                    <span className="block text-sm text-muted">{formatInstant(r.receivedAt, ctx.timezone, false)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`font-semibold ${r.status === "VOID" ? "text-muted line-through" : ""}`}>{formatMoney(r.amountMinor, r.currency)}</span>
                    <ReceiptStatusChip status={r.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
