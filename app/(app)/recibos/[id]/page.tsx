import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye } from "lucide-react";
import { requireTenant } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/security/tenant";
import { getReceipt, PAYMENT_METHOD_LABEL, TAX_TREATMENT_LABEL, type PaymentMethod } from "@/features/receipts/service";
import { formatMoney, formatPercent } from "@/lib/money";
import { importeConLetra } from "@/lib/money/words";
import { formatInstant } from "@/lib/utils/dates";
import { Alert, Card, DefinitionList, PageHeader } from "@/components/ui/misc";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { ReceiptStatusChip } from "@/components/domain/status";
import { VoidReceiptButton } from "./void-button";

export const metadata: Metadata = { title: "Recibo" };

export default async function ReceiptDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ emitido?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx } = await requireTenant();
  const { receipt, document: doc, quote } = await getReceipt(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const isVoid = receipt.status === "VOID";
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader back={{ href: "/recibos", label: "Recibos" }} title={receipt.folio} subtitle={<span className="break-anywhere">{receipt.payerName}</span>} />
      {sp.emitido ? <Alert tone="success" title="Recibo emitido">Folio {receipt.folio}. Ya puedes descargarlo o compartirlo.</Alert> : null}
      {isVoid ? (
        <Alert tone="danger" title="Recibo anulado">
          Motivo: {receipt.voidReason} · {receipt.voidedAt ? formatInstant(receipt.voidedAt, ctx.timezone) : ""}. No cuenta para ningún saldo.
        </Alert>
      ) : null}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <ReceiptStatusChip status={receipt.status} />
          <span className="text-sm text-muted">{doc.brand.name}</span>
        </div>
        <p className={`text-3xl font-semibold ${isVoid ? "text-muted line-through" : ""}`}>{formatMoney(receipt.amountMinor, receipt.currency)}</p>
        <p className="text-sm text-muted">{importeConLetra(receipt.amountMinor, receipt.currency)}</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/recibos/${receipt.id}/vista-previa`} variant="secondary">
            <Eye size={18} aria-hidden /> Vista previa
          </ButtonLink>
          <a href={`/api/receipts/${receipt.id}/pdf?descargar=1`} className={buttonClass("primary")}>
            <Download size={18} aria-hidden /> Descargar PDF
          </a>
          {!isVoid && can(ctx.role, "receipts.void") ? <VoidReceiptButton receiptId={receipt.id} folio={receipt.folio} /> : null}
        </div>
      </Card>
      <Card>
        <DefinitionList
          items={[
            { label: "Recibimos de", value: receipt.payerName },
            { label: "Concepto", value: receipt.concept },
            { label: "Fecha de recepción", value: formatInstant(receipt.receivedAt, ctx.timezone) },
            { label: "Método", value: PAYMENT_METHOD_LABEL[receipt.paymentMethod as PaymentMethod] },
            receipt.paymentReference ? { label: "Referencia", value: receipt.paymentReference } : null,
            { label: "IVA", value: receipt.taxTreatment === "NONE" ? "Sin IVA" : `${TAX_TREATMENT_LABEL[receipt.taxTreatment as "INCLUDED" | "ADDED"]} ${formatPercent(receipt.taxRate)}: base ${formatMoney(receipt.netMinor, receipt.currency)} + IVA ${formatMoney(receipt.taxMinor, receipt.currency)}` },
            quote ? { label: "Cotización", value: <Link className="text-link underline" href={`/cotizaciones/${quote.id}`}>{quote.folio}</Link> } : { label: "Cotización", value: "Recibo independiente" },
            receipt.notesPublic ? { label: "Notas", value: receipt.notesPublic } : null,
            receipt.notesInternal ? { label: "Notas internas", value: receipt.notesInternal } : null,
          ]}
        />
      </Card>
      <p className="text-xs text-muted">Comprobante comercial de recepción de pago. No sustituye un CFDI.</p>
    </div>
  );
}
