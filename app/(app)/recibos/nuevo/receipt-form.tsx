"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { issueReceiptAction, searchPayableQuotesAction } from "@/features/receipts/actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, TAX_TREATMENT_LABEL } from "@/features/receipts/constants";
import { computeReceiptAmounts, formatMoney, parseAmountToMinor, type ReceiptTaxTreatment } from "@/lib/money";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card } from "@/components/ui/misc";
import { ClientPicker, type ClientOption } from "@/components/domain/client-picker";

interface Prefill {
  quoteId: string;
  folio: string | null;
  brandId: string;
  clientId: string | null;
  payerName: string;
  currency: string;
  concept: string;
  balanceMinor: number;
  paidMinor: number;
  totalMinor: number;
  versionNumber: number;
  suggestedTaxTreatment: ReceiptTaxTreatment;
  suggestedTaxRate: string;
  taxNote: string | null;
}

interface QuoteOption {
  id: string;
  folio: string | null;
  title: string | null;
  clientName: string | null;
  currency: string;
  totalMinor: number;
  status: string;
}

export function ReceiptForm({
  brands,
  prefill,
  defaultReceivedAt,
}: {
  brands: Array<{ id: string; name: string; currency: string; signatureName: string | null }>;
  prefill: Prefill | null;
  defaultReceivedAt: string;
}) {
  const router = useRouter();
  // Clave de idempotencia estable para esta pantalla: evita recibos duplicados por doble clic o reintentos.
  const idempotencyKey = useRef(crypto.randomUUID());
  const [linked, setLinked] = useState<Prefill | null>(prefill);
  const [form, setForm] = useState({
    brandId: prefill?.brandId ?? brands[0].id,
    payerName: prefill?.payerName ?? "",
    concept: prefill?.concept ?? "",
    paymentMethod: "TRANSFER" as (typeof PAYMENT_METHODS)[number],
    paymentReference: "",
    receivedAtLocal: defaultReceivedAt,
    currency: (prefill?.currency ?? brands[0].currency) as "MXN" | "USD",
    amount: prefill ? (prefill.balanceMinor / 100).toFixed(2) : "",
    taxTreatment: (prefill?.suggestedTaxTreatment ?? "NONE") as ReceiptTaxTreatment,
    taxRate: prefill?.suggestedTaxRate ?? "16",
    notesPublic: "",
    notesInternal: "",
    signatureName: brands.find((b) => b.id === (prefill?.brandId ?? brands[0].id))?.signatureName ?? "",
  });
  const [client, setClient] = useState<ClientOption | null>(
    prefill?.clientId ? { id: prefill.clientId, name: prefill.payerName, businessName: null, taxId: null, email: null, preferredCurrency: null } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState<QuoteOption[] | null>(null);

  const preview = useMemo(() => {
    try {
      const minor = parseAmountToMinor(form.amount || "0");
      if (minor <= 0) return null;
      return computeReceiptAmounts(minor, form.taxTreatment, form.taxRate || "0");
    } catch {
      return null;
    }
  }, [form.amount, form.taxTreatment, form.taxRate]);

  const missing: string[] = [];
  if (!form.brandId) missing.push("marca");
  if (!form.payerName.trim()) missing.push("quién paga");
  if (!form.concept.trim()) missing.push("concepto");
  if (!preview) missing.push("monto válido");
  const exceeds = Boolean(linked && preview && preview.amountMinor > linked.balanceMinor);

  async function submit() {
    if (missing.length || exceeds) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const res = await issueReceiptAction({
      idempotencyKey: idempotencyKey.current,
      brandId: form.brandId,
      quoteId: linked?.quoteId ?? null,
      clientId: client?.id ?? null,
      payerName: form.payerName,
      concept: form.concept,
      paymentMethod: form.paymentMethod,
      paymentReference: form.paymentReference,
      receivedAtLocal: form.receivedAtLocal,
      currency: form.currency,
      amount: form.amount,
      taxTreatment: form.taxTreatment,
      taxRate: form.taxRate,
      notesPublic: form.notesPublic,
      notesInternal: form.notesInternal,
      signatureName: form.signatureName,
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      setFieldErrors(res.fieldErrors ?? {});
      return;
    }
    router.push(`/recibos/${res.data.id}?emitido=1`);
  }

  async function findQuotes(q: string) {
    setQuoteSearch(await searchPayableQuotesAction(q));
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Cotización vinculada (opcional)</h2>
        {linked ? (
          <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] bg-surface-muted p-3">
            <p className="font-semibold">
              {linked.folio} · V{linked.versionNumber}
            </p>
            <p className="text-sm text-muted">
              Total {formatMoney(linked.totalMinor, linked.currency)} · Pagado {formatMoney(linked.paidMinor, linked.currency)} ·{" "}
              <strong className="text-text">Saldo {formatMoney(linked.balanceMinor, linked.currency)}</strong>
            </p>
            {!prefill ? (
              <button type="button" className="w-fit text-sm text-link underline" onClick={() => setLinked(null)}>
                Quitar vínculo (recibo independiente)
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">Sin vínculo, el recibo es independiente. Para descontar del saldo de una cotización, vincúlala.</p>
            <div className="flex gap-2">
              <input aria-label="Buscar cotización por folio o cliente" className="control" placeholder="Folio o cliente…" onChange={(e) => void findQuotes(e.target.value)} onFocus={(e) => void findQuotes(e.target.value)} />
            </div>
            {quoteSearch ? (
              <ul className="card max-h-60 overflow-auto p-1">
                {quoteSearch.length === 0 ? <li className="p-3 text-sm text-muted">Sin cotizaciones enviadas o aprobadas.</li> : null}
                {quoteSearch.map((q) => (
                  <li key={q.id}>
                    <Link href={`/recibos/nuevo?cotizacion=${q.id}`} className="flex min-h-11 flex-col rounded-lg px-3 py-2 hover:bg-surface-muted">
                      <span className="font-medium">
                        {q.folio} · {q.clientName ?? "Sin cliente"}
                      </span>
                      <span className="text-sm text-muted">{formatMoney(q.totalMinor, q.currency)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Datos del pago</h2>
        {brands.length > 1 ? (
          <Field label="Marca emisora" htmlFor="r-brand" required>
            <Select id="r-brand" value={form.brandId} disabled={Boolean(linked)} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {!linked ? (
          <ClientPicker
            label="Cliente del catálogo (opcional)"
            value={client}
            onChange={(c) => {
              setClient(c);
              if (c) setForm((f) => ({ ...f, payerName: c.name }));
            }}
          />
        ) : null}
        <Field label="Recibimos de" htmlFor="r-payer" required error={fieldErrors.payerName}>
          <Input id="r-payer" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} maxLength={250} />
        </Field>
        <Field label="Concepto del pago" htmlFor="r-concept" required error={fieldErrors.concept}>
          <Textarea id="r-concept" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} rows={2} maxLength={2000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Método" htmlFor="r-method">
            <Select id="r-method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as typeof form.paymentMethod })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Referencia (opcional)" htmlFor="r-ref">
            <Input id="r-ref" value={form.paymentReference} onChange={(e) => setForm({ ...form, paymentReference: e.target.value })} maxLength={200} />
          </Field>
          <Field label="Fecha y hora de recepción" htmlFor="r-date" error={fieldErrors.receivedAt}>
            <Input id="r-date" type="datetime-local" value={form.receivedAtLocal} onChange={(e) => setForm({ ...form, receivedAtLocal: e.target.value })} />
          </Field>
          <Field label="Moneda" htmlFor="r-cur" hint={linked ? "Igual a la cotización vinculada." : undefined} error={fieldErrors.currency}>
            <Select id="r-cur" value={form.currency} disabled={Boolean(linked)} onChange={(e) => setForm({ ...form, currency: e.target.value as "MXN" | "USD" })}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={form.taxTreatment === "ADDED" ? `Monto base (${form.currency})` : `Monto recibido (${form.currency})`} htmlFor="r-amount" required error={fieldErrors.amount}>
            <Input id="r-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
          </Field>
          <Field
            label="IVA (informativo)"
            htmlFor="r-tax"
            hint={
              linked
                ? (linked.taxNote ??
                  (linked.suggestedTaxTreatment === "INCLUDED" ? `Según la cotización: el pago incluye IVA ${linked.suggestedTaxRate} %.` : undefined))
                : undefined
            }
          >
            <Select id="r-tax" value={form.taxTreatment} onChange={(e) => setForm({ ...form, taxTreatment: e.target.value as ReceiptTaxTreatment })}>
              {(Object.keys(TAX_TREATMENT_LABEL) as ReceiptTaxTreatment[]).map((t) => (
                <option key={t} value={t}>
                  {TAX_TREATMENT_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          {form.taxTreatment !== "NONE" ? (
            <Field label="Tasa de IVA (%)" htmlFor="r-rate">
              <Input id="r-rate" inputMode="decimal" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
            </Field>
          ) : null}
        </div>
        {preview ? (
          <div className="rounded-[var(--radius-sm)] bg-surface-muted p-3 text-sm" aria-live="polite">
            {form.taxTreatment !== "NONE" ? (
              <p className="text-muted">
                Base {formatMoney(preview.netMinor, form.currency)} + IVA {formatMoney(preview.taxMinor, form.currency)}
              </p>
            ) : null}
            <p className="text-lg font-semibold">Total recibido: {formatMoney(preview.amountMinor, form.currency)}</p>
          </div>
        ) : null}
        {exceeds && linked ? <Alert tone="danger">El pago excede el saldo pendiente ({formatMoney(linked.balanceMinor, linked.currency)}). No se admiten sobrepagos.</Alert> : null}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Notas y firma</h2>
        <Field label="Notas visibles en el recibo" htmlFor="r-notes">
          <Textarea id="r-notes" value={form.notesPublic} onChange={(e) => setForm({ ...form, notesPublic: e.target.value })} rows={2} />
        </Field>
        <Field label="Notas internas" htmlFor="r-internal" hint="No se imprimen.">
          <Textarea id="r-internal" value={form.notesInternal} onChange={(e) => setForm({ ...form, notesInternal: e.target.value })} rows={2} />
        </Field>
        <Field label="Nombre de quien firma (opcional)" htmlFor="r-sign">
          <Input id="r-sign" value={form.signatureName} onChange={(e) => setForm({ ...form, signatureName: e.target.value })} />
        </Field>
      </Card>

      <div className="sticky-actions">
        <div className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted" aria-live="polite">
            {missing.length ? `Falta: ${missing.join(", ")}.` : exceeds ? "El monto excede el saldo." : "Listo para emitir. El recibo emitido no se puede editar; solo anular."}
          </p>
          <div className="flex gap-2">
            <Link href={linked ? `/cotizaciones/${linked.quoteId}` : "/recibos"} className={buttonClass("secondary")}>
              Cancelar
            </Link>
            <Button type="submit" disabled={busy || missing.length > 0 || exceeds} className="flex-1 sm:flex-none">
              {busy ? "Emitiendo…" : "Emitir recibo"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
