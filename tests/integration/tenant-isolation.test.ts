import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/security/tenant";
import { AppError } from "@/lib/errors";
import { getBrand, readFile, updateBrand, uploadBrandLogo } from "@/features/brands/service";
import { archiveClient, getClient, listClients, updateClient } from "@/features/clients/service";
import { changeQuoteStatus, createQuote, getEditorData, getQuoteDetail, listQuotes, saveDraft } from "@/features/quotes/service";
import { getReceipt, issueReceipt, listReceipts, voidReceipt } from "@/features/receipts/service";
import { renderQuotePdf, renderReceiptPdf } from "@/features/documents/render";
import { exportCsv } from "@/features/documents/export";
import { addMember, listMembers } from "@/features/organizations/service";
import { item, makeQuote, setupTenant } from "./helpers";

const dbError = (re: RegExp) => (e: unknown) => {
  const err = e as { message?: string; cause?: { message?: string } };
  return re.test(`${err?.message ?? ""} ${err?.cause?.message ?? ""}`);
};

async function expectNotFound(p: Promise<unknown>) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === "NOT_FOUND");
}

describe("aislamiento multi-tenant (IDOR y RLS)", () => {
  let A: Awaited<ReturnType<typeof setupTenant>>;
  let B: Awaited<ReturnType<typeof setupTenant>>;
  let quoteA: string;
  let receiptA: string;
  let logoA: string;

  beforeAll(async () => {
    A = await setupTenant("Alfa");
    B = await setupTenant("Beta");
    quoteA = await makeQuote(A.ctx, A.brand.id, A.client.id, [item("Servicio A", "1", "1000")], { approve: true });
    const r = await issueReceipt(A.ctx, { idempotencyKey: randomUUID(), brandId: A.brand.id, quoteId: quoteA, payerName: "Pagador A", concept: "Anticipo", paymentMethod: "CASH", receivedAt: new Date(), currency: "MXN", amount: "100" });
    receiptA = r.receipt.id;
    const png = await sharp({ create: { width: 300, height: 100, channels: 3, background: "#123456" } }).png().toBuffer();
    logoA = (await uploadBrandLogo(A.ctx, A.brand.id, png)).fileId;
  });

  it("B no puede leer cotización, recibo, cliente, marca ni logo de A", async () => {
    await expectNotFound(getQuoteDetail(B.ctx, quoteA));
    await expectNotFound(getReceipt(B.ctx, receiptA));
    await expectNotFound(getClient(B.ctx, A.client.id));
    await expectNotFound(getBrand(B.ctx, A.brand.id));
    await expectNotFound(readFile(B.ctx, logoA));
  });

  it("B no puede descargar PDFs de A", async () => {
    await expectNotFound(renderQuotePdf(B.ctx, quoteA));
    await expectNotFound(renderReceiptPdf(B.ctx, receiptA));
  });

  it("B no puede modificar, emitir, anular ni vincular documentos de A", async () => {
    const e = await getEditorData(A.ctx, await makeQuote(A.ctx, A.brand.id, null, [item("x", "1", "1")]));
    await expectNotFound(saveDraft(B.ctx, e.quote.id, e.version.id, e.version.revision, { ...e.draft, brandId: B.brand.id }));
    await expectNotFound(changeQuoteStatus(B.ctx, quoteA, "REJECTED"));
    await expectNotFound(voidReceipt(B.ctx, receiptA, "intento malicioso"));
    await expectNotFound(updateClient(B.ctx, A.client.id, { name: "hackeado" }));
    await expectNotFound(archiveClient(B.ctx, A.client.id));
    await expectNotFound(updateBrand(B.ctx, A.brand.id, { name: "hackeada" }));
    await expectNotFound(createQuote(B.ctx, { brandId: A.brand.id }));
    await expectNotFound(createQuote(B.ctx, { brandId: B.brand.id, clientId: A.client.id }));
    await expectNotFound(
      issueReceipt(B.ctx, { idempotencyKey: randomUUID(), brandId: B.brand.id, quoteId: quoteA, payerName: "x", concept: "x", paymentMethod: "CASH", receivedAt: new Date(), currency: "MXN", amount: "1" }),
    );
    // Un borrador de B no puede apuntar a la marca o cliente de A
    const qb = await createQuote(B.ctx, { brandId: B.brand.id });
    const eb = await getEditorData(B.ctx, qb.quoteId);
    await expectNotFound(saveDraft(B.ctx, qb.quoteId, eb.version.id, eb.version.revision, { ...eb.draft, clientId: A.client.id }));
    // Los datos de A siguen intactos
    expect((await getClient(A.ctx, A.client.id)).name).toBe("Cliente Alfa");
    expect((await getReceipt(A.ctx, receiptA)).receipt.status).toBe("ISSUED");
  });

  it("listados y exportaciones solo muestran datos propios", async () => {
    const qs = await listQuotes(B.ctx, {});
    expect(qs.rows.some((r) => r.id === quoteA)).toBe(false);
    const rs = await listReceipts(B.ctx, {});
    expect(rs.rows.some((r) => r.id === receiptA)).toBe(false);
    const cs = await listClients(B.ctx, { q: "Alfa" });
    expect(cs.total).toBe(0);
    const csv = await exportCsv(B.ctx, "clientes");
    expect(csv).not.toContain("Cliente Alfa");
    const members = await listMembers(B.ctx);
    expect(members.map((m) => m.userId)).toEqual([B.user.id]);
  });

  it("RLS: aun sin filtro WHERE, el rol de aplicación solo ve filas de la organización activa", async () => {
    const rows = await withTenant(B.ctx, (tx) => tx.execute<{ organization_id: string }>(sql`select organization_id from quotes`));
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r) => r.organization_id === B.ctx.organizationId)).toBe(true);
    const files = await withTenant(B.ctx, (tx) => tx.execute(sql`select id from files`));
    expect(files.rows.length).toBe(0);
  });

  it("RLS: sin contexto de organización no se ve ninguna fila de negocio", async () => {
    const r = await db().execute<{ n: number }>(sql`select count(*)::int as n from quotes`);
    expect(r.rows[0].n).toBe(0);
    const r2 = await db().execute<{ n: number }>(sql`select count(*)::int as n from receipts`);
    expect(r2.rows[0].n).toBe(0);
  });

  it("RLS: no se pueden insertar filas en otra organización", async () => {
    await expect(
      withTenant(B.ctx, (tx) => tx.execute(sql`insert into clients (organization_id, name) values (${A.ctx.organizationId}, 'intruso')`)),
    ).rejects.toSatisfy(dbError(/row-level security/));
  });

  it("el rol de aplicación no tiene BYPASSRLS ni puede borrar recibos", async () => {
    const r = await db().execute<{ rolbypassrls: boolean; rolsuper: boolean }>(sql`select rolbypassrls, rolsuper from pg_roles where rolname = current_user`);
    expect(r.rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
    await expect(withTenant(A.ctx, (tx) => tx.execute(sql`delete from receipts where id = ${receiptA}`))).rejects.toSatisfy(dbError(/permission denied/));
    await expect(withTenant(A.ctx, (tx) => tx.execute(sql`delete from audit_logs`))).rejects.toSatisfy(dbError(/permission denied/));
  });

  it("ids malformados responden NOT_FOUND sin filtrar información", async () => {
    await expectNotFound(getQuoteDetail(A.ctx, "no-es-uuid"));
    await expectNotFound(getReceipt(A.ctx, "1' OR '1'='1"));
  });

  it("roles: MEMBER no puede gestionar marcas ni integrantes", async () => {
    const C = await setupTenant("Gamma");
    const member = await setupTenant("Delta");
    await addMember(C.ctx, { email: (await db().execute<{ email: string }>(sql`select email from users where id = ${member.user.id}`)).rows[0].email, role: "MEMBER" });
    const memberCtx = { ...C.ctx, userId: member.user.id, role: "MEMBER" as const };
    await expect(updateBrand(memberCtx, C.brand.id, { name: "x" })).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === "FORBIDDEN");
    await expect(addMember(memberCtx, { email: "otro@test.local", role: "ADMIN" })).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === "FORBIDDEN");
    await expect(voidReceipt(memberCtx, randomUUID(), "motivo")).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === "FORBIDDEN");
  });
});
