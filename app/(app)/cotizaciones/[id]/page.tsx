import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { getQuoteDetail } from "@/features/quotes/service";
import { displayStatus, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/features/quotes/status";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/features/receipts/service";
import { formatDecimal, formatMoney, formatPercent, formatUnitPrice, retentionLabel } from "@/lib/money";
import { formatCalendarDate, formatInstant, todayInTimeZone } from "@/lib/utils/dates";
import { Alert, Card, DefinitionList, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { PaymentStatusChip, QuoteStatusChip, ReceiptStatusChip } from "@/components/domain/status";
import { QuoteActions } from "./quote-actions";

export const metadata: Metadata = { title: "Cotización" };

export default async function QuoteDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; enviada?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx } = await requireTenant();
  const d = await getQuoteDetail(ctx, id, sp.v ? Number(sp.v) : undefined).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const doc = d.document;
  const today = todayInTimeZone(ctx.timezone);
  const status = displayStatus(d.version.status as QuoteStatus, d.version.validUntil, today);
  const pdfBase = `/api/quotes/${d.quote.id}/pdf?v=${d.version.versionNumber}`;
  const canPay = d.referenceVersionNumber !== null && d.balance.balanceMinor > 0 && !d.quote.archivedAt;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: "/cotizaciones", label: "Historial" }}
        title={d.quote.folio ?? "Borrador sin folio"}
        subtitle={
          <span className="break-anywhere">
            {doc.client?.name ?? "Sin cliente"} · Versión {d.version.versionNumber}
            {d.versions.length > 1 ? ` de ${d.versions.length}` : ""}
          </span>
        }
      />
      {sp.enviada ? <Alert tone="success" title="Cotización enviada">Se asignó el folio {d.quote.folio}. Ya puedes descargar el PDF y registrar pagos.</Alert> : null}
      {d.quote.archivedAt ? <Alert tone="warning">Esta cotización está archivada.</Alert> : null}
      {!d.isCurrent ? (
        <Alert tone="info">
          Estás viendo una versión anterior (solo lectura).{" "}
          <Link className="font-semibold underline" href={`/cotizaciones/${d.quote.id}`}>
            Ir a la versión actual
          </Link>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <QuoteStatusChip status={status} />
              {d.referenceVersionNumber !== null ? <PaymentStatusChip status={d.balance.status} /> : null}
            </div>
            <p className="text-3xl font-semibold tracking-tight">{formatMoney(doc.totals.totalMinor, doc.currency)}</p>
            {status === "EXPIRED" && d.version.status === "SENT" ? <p className="text-sm text-warning">La vigencia terminó el {formatCalendarDate(d.version.validUntil)}.</p> : null}
            <QuoteActions
              quoteId={d.quote.id}
              status={d.version.status as QuoteStatus}
              isCurrent={d.isCurrent}
              versionNumber={d.version.versionNumber}
              archived={Boolean(d.quote.archivedAt)}
              pdfUrl={pdfBase}
              canPay={canPay}
              filenameHint={`${d.quote.folio ?? "borrador"}`}
            />
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold">Datos</h2>
            <DefinitionList
              items={[
                { label: "Cliente", value: doc.client ? [doc.client.name, doc.client.businessName, doc.client.taxId].filter(Boolean).join(" · ") : "Sin cliente" },
                { label: "Marca", value: doc.brand.name },
                doc.title ? { label: "Proyecto", value: doc.title } : null,
                doc.issueDate ? { label: "Emisión", value: formatCalendarDate(doc.issueDate) } : null,
                doc.validUntil ? { label: "Vigente hasta", value: formatCalendarDate(doc.validUntil) } : null,
                { label: "Moneda", value: doc.currency },
                doc.location ? { label: "Ubicación", value: doc.location } : null,
                doc.duration ? { label: "Duración", value: doc.duration } : null,
                doc.responsible ? { label: "Responsable", value: doc.responsible } : null,
                ...doc.customFields.map((f) => ({ label: f.label, value: f.type === "checkbox" ? (f.value ? "Sí" : "No") : String(f.value) })),
              ]}
            />
            {doc.serviceDescription ? <p className="mt-3 whitespace-pre-line break-anywhere text-muted">{doc.serviceDescription}</p> : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold">Conceptos</h2>
            <div className="flex flex-col gap-4">
              {doc.sections.map((s, i) => (
                <div key={i} className="flex flex-col gap-2">
                  {s.title ? <h3 className="font-semibold">{s.title}</h3> : null}
                  <ol className="flex flex-col divide-y divide-border">
                    {s.items.map((it, j) => (
                      <li key={j} className="flex flex-col gap-1 py-3">
                        <p className="whitespace-pre-line break-anywhere">{it.description || "—"}</p>
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                          <span className="text-muted">
                            {formatDecimal(it.quantity)} {it.unit ?? ""} × {formatUnitPrice(it.unitPrice, doc.currency)}
                            {it.discountMinor > 0 ? ` · desc. -${formatMoney(it.discountMinor, doc.currency)}` : ""}
                            {it.taxMode !== "NONE" ? ` · IVA ${formatPercent(it.taxRate)}${it.taxMode === "INCLUSIVE" ? " incluido" : ""}` : ""}
                          </span>
                          <span className="font-semibold">{formatMoney(it.amountMinor, doc.currency)}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {s.title && s.showSubtotal ? <p className="text-right text-sm text-muted">Subtotal {s.title}: <strong className="text-text">{formatMoney(s.subtotalMinor, doc.currency)}</strong></p> : null}
                </div>
              ))}
            </div>
            <dl className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-sm sm:ml-auto sm:w-80">
              {doc.totals.discountMinor > 0 ? (
                <>
                  <Row k="Importe bruto" v={formatMoney(doc.totals.grossMinor, doc.currency)} />
                  <Row k="Descuentos" v={`-${formatMoney(doc.totals.discountMinor, doc.currency)}`} />
                </>
              ) : null}
              <Row k="Subtotal" v={formatMoney(doc.totals.subtotalMinor, doc.currency)} />
              {doc.totals.taxBreakdown.map((t) => (
                <Row key={t.mode + t.rate} k={`IVA ${formatPercent(t.rate)}${t.mode === "INCLUSIVE" ? " (incluido)" : ""}`} v={formatMoney(t.taxMinor, doc.currency)} />
              ))}
              {doc.totals.retentions?.length ? (
                <>
                  <Row k="Total antes de retenciones" v={formatMoney(doc.totals.totalBeforeRetentionsMinor ?? doc.totals.totalMinor, doc.currency)} />
                  {doc.totals.retentions.map((r) => (
                    <Row key={r.kind} k={retentionLabel(r)} v={`-${formatMoney(r.amountMinor, doc.currency)}`} />
                  ))}
                </>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>{doc.totals.retentions?.length ? "Total a pagar" : "Total"}</dt>
                <dd>{formatMoney(doc.totals.totalMinor, doc.currency)}</dd>
              </div>
            </dl>
          </Card>

          {doc.paymentTerms || doc.validityTerms || doc.publicNotes || d.version.internalNotes ? (
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Condiciones</h2>
              <DefinitionList
                items={[
                  doc.paymentTerms ? { label: "Condiciones de pago", value: doc.paymentTerms } : null,
                  doc.validityTerms ? { label: "Vigencia", value: doc.validityTerms } : null,
                  doc.publicNotes ? { label: "Notas", value: doc.publicNotes } : null,
                  d.version.internalNotes ? { label: "Notas internas (no se imprimen)", value: d.version.internalNotes } : null,
                ]}
              />
            </Card>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Pagos y saldo</h2>
            {d.referenceVersionNumber === null ? (
              <p className="text-sm text-muted">El saldo se calcula cuando la cotización se envía o se aprueba.</p>
            ) : (
              <>
                <dl className="flex flex-col gap-1.5 text-sm">
                  <Row k={`Total de referencia (V${d.referenceVersionNumber})`} v={formatMoney(d.balance.baseTotalMinor ?? 0, doc.currency)} />
                  <Row k="Pagado (recibos activos)" v={formatMoney(d.balance.paidMinor, doc.currency)} />
                  <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                    <dt>Saldo pendiente</dt>
                    <dd>{formatMoney(d.balance.balanceMinor, doc.currency)}</dd>
                  </div>
                </dl>
                {d.referenceVersionNumber !== d.versions[d.versions.length - 1].versionNumber ? (
                  <p className="mt-2 text-xs text-muted">El saldo usa la V{d.referenceVersionNumber} (última aprobada o enviada). Los pagos no se reasignan automáticamente a versiones nuevas.</p>
                ) : null}
                {canPay ? (
                  <ButtonLink href={`/recibos/nuevo?cotizacion=${d.quote.id}`} className="mt-3 w-full">
                    Registrar pago / Emitir recibo
                  </ButtonLink>
                ) : null}
              </>
            )}
            {d.receipts.length ? (
              <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
                {d.receipts.map((r) => (
                  <li key={r.id}>
                    <Link href={`/recibos/${r.id}`} className="flex flex-col gap-1 py-3 hover:bg-surface-muted">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-link">{r.folio}</span>
                        <ReceiptStatusChip status={r.status} />
                      </span>
                      <span className="flex justify-between gap-2 text-sm">
                        <span className="text-muted">
                          {formatInstant(r.receivedAt, ctx.timezone, false)} · {PAYMENT_METHOD_LABEL[r.paymentMethod as PaymentMethod]}
                        </span>
                        <span className={r.status === "VOID" ? "text-muted line-through" : "font-medium"}>{formatMoney(r.amountMinor, r.currency)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-semibold">Versiones</h2>
            <ol className="flex flex-col gap-1">
              {d.versions
                .slice()
                .reverse()
                .map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/cotizaciones/${d.quote.id}?v=${v.versionNumber}`}
                      aria-current={v.id === d.version.id ? "page" : undefined}
                      className={`flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 ${v.id === d.version.id ? "bg-surface-muted font-semibold" : "hover:bg-surface-muted"}`}
                    >
                      <span>
                        V{v.versionNumber} · {QUOTE_STATUS_LABEL[v.status as QuoteStatus]}
                      </span>
                      <span className="text-sm">{formatMoney(v.totalMinor, v.currency)}</span>
                    </Link>
                  </li>
                ))}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right whitespace-nowrap">{v}</dd>
    </div>
  );
}
