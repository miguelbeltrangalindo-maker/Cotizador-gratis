import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { getQuoteDetail, getEditorData, saveDraft, createQuoteVersion } from "@/features/quotes/service";
import { getReceipt, issueReceipt, listReceipts, voidReceipt, type ReceiptInput } from "@/features/receipts/service";
import { item, makeQuote, setupTenant } from "./helpers";

const isCode = (code: string) => (e: unknown) => e instanceof AppError && e.code === code;

describe("recibos y saldos", () => {
  let T: Awaited<ReturnType<typeof setupTenant>>;
  let quoteB: string;
  const base = (extra: Partial<ReceiptInput>): ReceiptInput => ({
    idempotencyKey: randomUUID(),
    brandId: T.brand.id,
    payerName: "Cliente Saldo",
    concept: "Pago",
    paymentMethod: "TRANSFER",
    receivedAt: new Date(),
    currency: "MXN",
    amount: "0",
    ...extra,
  });

  beforeAll(async () => {
    T = await setupTenant("Saldo");
    quoteB = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("Evento", "1", "10000")], { approve: true });
  });

  it("10,000 − 5,000 − 3,000 = 2,000; sobrepago rechazado; anular restaura a 5,000", async () => {
    const r1 = await issueReceipt(T.ctx, base({ quoteId: quoteB, amount: "5,000.00" }));
    const r2 = await issueReceipt(T.ctx, base({ quoteId: quoteB, amount: "3000" }));
    let d = await getQuoteDetail(T.ctx, quoteB);
    expect(d.balance).toEqual({ baseTotalMinor: 1000000, paidMinor: 800000, balanceMinor: 200000, status: "PARTIALLY_PAID" });
    await expect(issueReceipt(T.ctx, base({ quoteId: quoteB, amount: "3000" }))).rejects.toThrow(/excede el saldo/);
    await voidReceipt(T.ctx, r2.receipt.id, "Pago duplicado por error");
    d = await getQuoteDetail(T.ctx, quoteB);
    expect(d.balance.balanceMinor).toBe(500000);
    expect(d.balance.paidMinor).toBe(500000);
    // El recibo anulado se conserva, con motivo, y no puede anularse dos veces
    const v = await getReceipt(T.ctx, r2.receipt.id);
    expect(v.receipt.status).toBe("VOID");
    expect(v.document.voidReason).toBe("Pago duplicado por error");
    await expect(voidReceipt(T.ctx, r2.receipt.id, "otra vez")).rejects.toSatisfy(isCode("CONFLICT"));
    expect(r1.receipt.folio).toMatch(/^REC-\d{4}-\d{4}$/);
    // Snapshot con saldo al momento de emitir
    expect((await getReceipt(T.ctx, r1.receipt.id)).document.balanceAfter).toEqual({ paidMinor: 500000, balanceMinor: 500000 });
  });

  it("pago exacto deja saldo cero y estado Pagada", async () => {
    const q = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("x", "1", "100")], { send: true });
    await issueReceipt(T.ctx, base({ quoteId: q, amount: "100" }));
    const d = await getQuoteDetail(T.ctx, q);
    expect(d.balance.status).toBe("PAID");
    expect(d.balance.balanceMinor).toBe(0);
  });

  it("idempotencia: la misma clave no duplica (doble clic, reintentos y concurrencia)", async () => {
    const key = randomUUID();
    const input = base({ idempotencyKey: key, amount: "10", payerName: "Idem" });
    const [a, b, c] = await Promise.all([issueReceipt(T.ctx, input), issueReceipt(T.ctx, input), issueReceipt(T.ctx, input)]);
    expect(new Set([a.receipt.id, b.receipt.id, c.receipt.id]).size).toBe(1);
    expect([a, b, c].filter((x) => !x.duplicated)).toHaveLength(1);
    const again = await issueReceipt(T.ctx, input);
    expect(again.duplicated).toBe(true);
    const list = await listReceipts(T.ctx, { q: "Idem" });
    expect(list.total).toBe(1);
  });

  it("pagos simultáneos no exceden el total (bloqueo de la cotización)", async () => {
    const q = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("x", "1", "1000")], { send: true });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => issueReceipt(T.ctx, base({ quoteId: q, amount: "400" }))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const d = await getQuoteDetail(T.ctx, q);
    expect(d.balance.paidMinor).toBe(80000);
  });

  it("no mezcla monedas: recibo MXN contra cotización USD se rechaza", async () => {
    const q = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("x", "1", "100")], { send: true, currency: "USD" });
    await expect(issueReceipt(T.ctx, base({ quoteId: q, amount: "10", currency: "MXN" }))).rejects.toThrow(/No se mezclan monedas/);
    await issueReceipt(T.ctx, base({ quoteId: q, amount: "10", currency: "USD" }));
  });

  it("no permite pagos sobre borradores ni montos cero o negativos", async () => {
    const draft = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("x", "1", "100")]);
    await expect(issueReceipt(T.ctx, base({ quoteId: draft, amount: "10" }))).rejects.toThrow(/enviada o aprobada/);
    await expect(issueReceipt(T.ctx, base({ amount: "0" }))).rejects.toSatisfy(isCode("VALIDATION_ERROR"));
    await expect(issueReceipt(T.ctx, base({ amount: "-5" }))).rejects.toSatisfy(isCode("VALIDATION_ERROR"));
    await expect(issueReceipt(T.ctx, base({ amount: "10", payerName: "  " }))).rejects.toSatisfy(isCode("VALIDATION_ERROR"));
  });

  it("recibo independiente de 1,500 MXN en efectivo, con IVA incluido informativo", async () => {
    const r = await issueReceipt(T.ctx, base({ amount: "1500", paymentMethod: "CASH", taxTreatment: "INCLUDED", taxRate: "16", payerName: "Mostrador" }));
    expect(r.receipt.quoteId).toBeNull();
    expect(r.receipt.amountMinor).toBe(150000);
    expect(r.receipt.taxMinor + r.receipt.netMinor).toBe(150000);
    expect(r.receipt.taxMinor).toBe(20690);
  });

  it("una revisión no reasigna pagos: el saldo sigue con la versión aprobada hasta aprobar la nueva", async () => {
    const q = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("x", "1", "1000")], { approve: true });
    await issueReceipt(T.ctx, base({ quoteId: q, amount: "400" }));
    await createQuoteVersion(T.ctx, q);
    const e = await getEditorData(T.ctx, q);
    // Cambiar moneda con pagos existentes está bloqueado
    await expect(saveDraft(T.ctx, q, e.version.id, e.version.revision, { ...e.draft, currency: "USD" })).rejects.toThrow(/moneda/);
    await saveDraft(T.ctx, q, e.version.id, e.version.revision, { ...e.draft, items: [item("x", "1", "1500")] });
    const d = await getQuoteDetail(T.ctx, q);
    expect(d.referenceVersionNumber).toBe(1);
    expect(d.balance.balanceMinor).toBe(60000);
  });
});
