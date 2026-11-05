import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  changeQuoteStatus,
  createQuote,
  createQuoteVersion,
  duplicateQuote,
  getEditorData,
  getQuoteDetail,
  listQuotes,
  saveDraft,
} from "@/features/quotes/service";
import { updateBrand } from "@/features/brands/service";
import { createCustomField } from "@/features/custom-fields/service";
import { item, makeQuote, setupTenant } from "./helpers";

const isCode = (code: string) => (e: unknown) => e instanceof AppError && e.code === code;

describe("cotizaciones: guardado, cálculo, versiones, estados y folios", () => {
  let T: Awaited<ReturnType<typeof setupTenant>>;
  beforeAll(async () => {
    T = await setupTenant("Cotiza", { currency: "USD", prefix: "MB" });
  });

  it("persiste y relee exactamente los totales (3×300 + 2×350 + IVA 16 % = 1,856 USD)", async () => {
    const id = await makeQuote(
      T.ctx,
      T.brand.id,
      T.client.id,
      [item("Fotografía", "3", "300", { taxMode: "EXCLUSIVE", taxRate: "16" }), item("Video", "2", "350", { taxMode: "EXCLUSIVE", taxRate: "16" })],
      { currency: "USD" },
    );
    const d = await getQuoteDetail(T.ctx, id);
    expect(d.version.subtotalMinor).toBe(160000);
    expect(d.version.taxMinor).toBe(25600);
    expect(d.version.totalMinor).toBe(185600);
    expect(d.document.totals.totalMinor).toBe(185600);
    expect(d.document.currency).toBe("USD");
    const e = await getEditorData(T.ctx, id);
    expect(e.draft.items.map((i) => [i.quantity, i.unitPrice])).toEqual([
      ["3", "300.00"],
      ["2", "350.00"],
    ]);
  });

  it("RESICO: guarda tasas y retenciones, el total a pagar es el neto y queda en el snapshot", async () => {
    const q = await createQuote(T.ctx, { brandId: T.brand.id, clientId: T.client.id });
    const e = await getEditorData(T.ctx, q.quoteId);
    expect(e.draft.retentionIvaRate).toBe("0");
    await saveDraft(T.ctx, q.quoteId, e.version.id, e.version.revision, {
      ...e.draft,
      currency: "MXN",
      retentionIvaRate: "10.6667",
      retentionIsrRate: "1.25",
      items: [item("Servicio", "1", "10000", { taxMode: "EXCLUSIVE", taxRate: "16" })],
    });
    await changeQuoteStatus(T.ctx, q.quoteId, "SENT");
    const d = await getQuoteDetail(T.ctx, q.quoteId);
    expect(d.version.retentionMinor).toBe(119167);
    expect(d.version.totalMinor).toBe(1040833);
    expect(d.document.totals.retentions?.map((r) => [r.kind, r.amountMinor])).toEqual([
      ["ISR", 12500],
      ["IVA", 106667],
    ]);
    const e2 = await getEditorData(T.ctx, q.quoteId);
    expect([e2.draft.retentionIvaRate, e2.draft.retentionIsrRate]).toEqual(["10.6667", "1.25"]);
  });

  it("las cotizaciones nuevas toman las retenciones sugeridas de la marca", async () => {
    const R = await setupTenant("Resico", { currency: "MXN", prefix: "RS" });
    await updateBrand(R.ctx, R.brand.id, { name: "Marca Resico", quotePrefix: "RS", defaultCurrency: "MXN", defaultRetentionIvaRate: 10.6667, defaultRetentionIsrRate: 1.25 });
    const q = await createQuote(R.ctx, { brandId: R.brand.id, clientId: R.client.id });
    const e = await getEditorData(R.ctx, q.quoteId);
    expect([e.draft.retentionIvaRate, e.draft.retentionIsrRate]).toEqual(["10.6667", "1.25"]);
  });

  it("el servidor recalcula: rechaza importes inválidos y descuentos excesivos", async () => {
    const q = await createQuote(T.ctx, { brandId: T.brand.id });
    const e = await getEditorData(T.ctx, q.quoteId);
    await expect(saveDraft(T.ctx, q.quoteId, e.version.id, e.version.revision, { ...e.draft, items: [item("x", "-1", "10")] })).rejects.toSatisfy(isCode("VALIDATION_ERROR"));
    await expect(saveDraft(T.ctx, q.quoteId, e.version.id, e.version.revision, { ...e.draft, items: [item("x", "1", "abc")] })).rejects.toSatisfy(isCode("VALIDATION_ERROR"));
    await expect(
      saveDraft(T.ctx, q.quoteId, e.version.id, e.version.revision, { ...e.draft, items: [item("x", "1", "100", { discountType: "FIXED", discountValue: "150" })] }),
    ).rejects.toSatisfy(isCode("VALIDATION_ERROR"));
  });

  it("conserva orden, secciones y textos largos sin truncar", async () => {
    const q = await createQuote(T.ctx, { brandId: T.brand.id });
    const e = await getEditorData(T.ctx, q.quoteId);
    const g = randomUUID();
    const long = "Párrafo largo con ñ y acentos. ".repeat(400);
    const items = [item("C", "1", "1"), item(long, "1", "2", { groupId: g }), item("A", "1.5", "200")];
    await saveDraft(T.ctx, q.quoteId, e.version.id, e.version.revision, { ...e.draft, groups: [{ id: g, title: "Sección 1", showSubtotal: true }], items });
    const again = await getEditorData(T.ctx, q.quoteId);
    expect(again.draft.items.map((i) => i.description)).toEqual(["C", long, "A"]);
    expect(again.draft.items[1].groupId).toBe(g);
    const d = await getQuoteDetail(T.ctx, q.quoteId);
    expect(d.document.sections.map((s) => s.title)).toEqual([null, "Sección 1"]);
    expect(d.document.sections[0].items.map((i) => i.description)).toEqual(["C", "A"]);
    expect(d.document.totals.totalMinor).toBe(100 + 200 + 30000);
  });

  it("control optimista: una revisión vieja no sobrescribe cambios (dos pestañas)", async () => {
    const q = await createQuote(T.ctx, { brandId: T.brand.id });
    const e = await getEditorData(T.ctx, q.quoteId);
    await saveDraft(T.ctx, q.quoteId, e.version.id, e.version.revision, { ...e.draft, title: "Pestaña 1" });
    await expect(saveDraft(T.ctx, q.quoteId, e.version.id, e.version.revision, { ...e.draft, title: "Pestaña 2" })).rejects.toSatisfy(isCode("CONFLICT"));
    expect((await getEditorData(T.ctx, q.quoteId)).draft.title).toBe("Pestaña 1");
  });

  it("no permite enviar sin cliente o sin conceptos", async () => {
    const id = await makeQuote(T.ctx, T.brand.id, null, [item("x", "1", "1")]);
    await expect(changeQuoteStatus(T.ctx, id, "SENT")).rejects.toThrow(/cliente/);
    const id2 = await makeQuote(T.ctx, T.brand.id, T.client.id, []);
    await expect(changeQuoteStatus(T.ctx, id2, "SENT")).rejects.toThrow(/concepto/);
  });

  it("campos personalizados obligatorios bloquean el envío", async () => {
    const C = await setupTenant("Campos");
    await createCustomField(C.ctx, { label: "Número de orden", type: "short_text", required: true });
    const id = await makeQuote(C.ctx, C.brand.id, C.client.id, [item("x", "1", "1")]);
    await expect(changeQuoteStatus(C.ctx, id, "SENT")).rejects.toThrow(/Número de orden/);
    const e = await getEditorData(C.ctx, id);
    await saveDraft(C.ctx, id, e.version.id, e.version.revision, { ...e.draft, customValues: { numero_de_orden: "OC-77" } });
    await changeQuoteStatus(C.ctx, id, "SENT");
    const d = await getQuoteDetail(C.ctx, id);
    expect(d.document.customFields).toEqual([{ label: "Número de orden", type: "short_text", value: "OC-77" }]);
  });

  it("transiciones absurdas rechazadas y versiones enviadas inmutables", async () => {
    const id = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("x", "1", "10")]);
    await expect(changeQuoteStatus(T.ctx, id, "APPROVED")).rejects.toSatisfy(isCode("CONFLICT"));
    await changeQuoteStatus(T.ctx, id, "SENT");
    const e = await getEditorData(T.ctx, id);
    await expect(saveDraft(T.ctx, id, e.version.id, e.version.revision, { ...e.draft, title: "cambio" })).rejects.toSatisfy(isCode("CONFLICT"));
    await changeQuoteStatus(T.ctx, id, "REJECTED");
    await expect(changeQuoteStatus(T.ctx, id, "APPROVED")).rejects.toSatisfy(isCode("CONFLICT"));
  });

  it("nueva versión conserva la anterior y su snapshot aunque cambie la marca", async () => {
    const id = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("Original", "1", "100")], { send: true });
    const v1 = await getQuoteDetail(T.ctx, id, 1);
    await updateBrand(T.ctx, T.brand.id, { name: "Marca Renombrada", colorPrimary: "#FF0000", quotePrefix: "MB", defaultCurrency: "USD" });
    const { versionNumber } = await createQuoteVersion(T.ctx, id);
    expect(versionNumber).toBe(2);
    const e = await getEditorData(T.ctx, id);
    await saveDraft(T.ctx, id, e.version.id, e.version.revision, { ...e.draft, items: [...e.draft.items, item("Extra", "1", "50")] });
    await changeQuoteStatus(T.ctx, id, "SENT");
    const v1again = await getQuoteDetail(T.ctx, id, 1);
    expect(v1again.document).toEqual(v1.document);
    expect(v1again.document.brand.name).toBe("Marca Cotiza");
    const v2 = await getQuoteDetail(T.ctx, id, 2);
    expect(v2.document.brand.name).toBe("Marca Renombrada");
    expect(v2.document.totals.totalMinor).toBe(15000);
    expect(v2.quote.folio).toBe(v1.quote.folio);
  });

  it("folios únicos y consecutivos con emisiones concurrentes", async () => {
    const C = await setupTenant("Concurrente", { prefix: "CC" });
    const ids = await Promise.all(Array.from({ length: 12 }, () => makeQuote(C.ctx, C.brand.id, C.client.id, [item("x", "1", "1")])));
    await Promise.all(ids.map((id) => changeQuoteStatus(C.ctx, id, "SENT")));
    const folios = (await Promise.all(ids.map((id) => getQuoteDetail(C.ctx, id)))).map((d) => d.quote.folio!);
    expect(new Set(folios).size).toBe(12);
    const nums = folios.map((f) => Number(f.split("-").pop())).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(folios[0]).toMatch(/^CC-\d{4}-\d{4}$/);
  });

  it("duplicar crea una cotización nueva en borrador, sin folio", async () => {
    const id = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("x", "2", "5")], { send: true });
    const { quoteId } = await duplicateQuote(T.ctx, id);
    const d = await getQuoteDetail(T.ctx, quoteId);
    expect(d.quote.folio).toBeNull();
    expect(d.version.status).toBe("DRAFT");
    expect(d.document.totals.totalMinor).toBe(1000);
  });

  it("búsqueda y filtros del historial", async () => {
    await makeQuote(T.ctx, T.brand.id, T.client.id, [item("x", "1", "1")], { title: "Boda en Valle de Bravo" });
    const r = await listQuotes(T.ctx, { q: "valle de bravo" });
    expect(r.rows).toHaveLength(1);
    const byCurrency = await listQuotes(T.ctx, { currency: "USD", pageSize: 50 });
    expect(byCurrency.rows.every((x) => x.currency === "USD")).toBe(true);
    const drafts = await listQuotes(T.ctx, { status: "DRAFT", pageSize: 50 });
    expect(drafts.rows.every((x) => x.status === "DRAFT")).toBe(true);
    const wildcard = await listQuotes(T.ctx, { q: "%" });
    expect(wildcard.total).toBe(0);
  });
});
