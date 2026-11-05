import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { renderQuotePdf, renderReceiptPdf } from "@/features/documents/render";
import { updateBrand, uploadBrandLogo } from "@/features/brands/service";
import { issueReceipt } from "@/features/receipts/service";
import { item, makeQuote, setupTenant } from "./helpers";

/** Extrae texto con pdftotext (poppler) si está disponible. */
function pdfText(buf: Buffer): { text: string; pages: number } | null {
  try {
    const dir = mkdtempSync(path.join(tmpdir(), "pdf-"));
    const file = path.join(dir, "doc.pdf");
    writeFileSync(file, buf);
    const text = execFileSync("pdftotext", ["-layout", file, "-"]).toString();
    const info = execFileSync("pdfinfo", [file]).toString();
    // Sin espacios: el espaciado entre letras de los títulos y el maquetado no afectan la verificación.
    return { text: text.replace(/\s+/g, ""), pages: Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0) };
  } catch {
    return null;
  }
}

describe("PDF", () => {
  let T: Awaited<ReturnType<typeof setupTenant>>;
  beforeAll(async () => {
    T = await setupTenant("Pdf", { prefix: "PDF", currency: "USD" });
  });

  it("documento largo (35 conceptos, descripciones extensas) en varias páginas, carta y A4", async () => {
    const items = Array.from({ length: 35 }, (_, i) =>
      item(`Concepto ${i + 1}: servicio con descripción detallada — ñandú, acción, pingüino.\n${"Texto adicional de varias líneas. ".repeat(i % 5 === 0 ? 30 : 2)}`, "1", "100", { taxMode: "EXCLUSIVE", taxRate: "16" }),
    );
    const id = await makeQuote(T.ctx, T.brand.id, T.client.id, items, { send: true, currency: "USD", title: "Proyecto extenso" });
    for (const paper of ["LETTER", "A4"] as const) {
      await updateBrand(T.ctx, T.brand.id, { name: "Marca Pdf", quotePrefix: "PDF", paperSize: paper, defaultCurrency: "USD" });
      const { buffer, filename } = await renderQuotePdf(T.ctx, id);
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
      expect(filename).toMatch(/^Cotizacion_PDF-\d{4}-0001_Cliente_Pdf_v1\.pdf$/);
      expect(buffer.length).toBeLessThan(1_500_000);
      const t = pdfText(buffer);
      if (t) {
        expect(t.pages).toBeGreaterThan(1);
        expect(t.text).toContain("COTIZACIÓN");
        expect(t.text).toMatch(/PDF-\d{4}-0001/);
        expect(t.text).toContain("ClientePdf");
        expect(t.text).toContain("$4,060.00USD");
        expect(t.text).toContain("Concepto35");
        expect(t.text).toContain("pingüino");
        expect(t.text).toMatch(/Página1de\d/);
      }
    }
  });

  it("logo horizontal, cuadrado y SVG (rasterizado); y sin logo", async () => {
    const id = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("Logo test", "1", "1")], { send: true, currency: "USD" });
    const noLogo = await renderQuotePdf(T.ctx, id);
    expect(noLogo.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const horizontal = await sharp({ create: { width: 800, height: 200, channels: 4, background: "#0E5E6F" } }).png().toBuffer();
    const square = await sharp({ create: { width: 400, height: 400, channels: 3, background: "#AA3300" } }).jpeg().toBuffer();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><script>alert(1)</script><rect width="200" height="80" fill="#333"/></svg>');
    for (const img of [horizontal, square, svg]) {
      const { fileId } = await uploadBrandLogo(T.ctx, T.brand.id, img);
      expect(fileId).toBeTruthy();
      // Los documentos ya enviados conservan el logo del snapshot (sin logo en este caso)
      const again = await renderQuotePdf(T.ctx, id);
      expect(again.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    }
    const id2 = await makeQuote(T.ctx, T.brand.id, T.client.id, [item("Con logo", "1", "1")], { send: true, currency: "USD" });
    const withLogo = await renderQuotePdf(T.ctx, id2);
    expect(withLogo.buffer.length).toBeGreaterThan(noLogo.buffer.length);
  });

  it("rechaza archivos que no son imagen", async () => {
    await expect(uploadBrandLogo(T.ctx, T.brand.id, Buffer.from("<html><script>x</script></html>"))).rejects.toThrow(/imagen|Formato/);
    await expect(uploadBrandLogo(T.ctx, T.brand.id, Buffer.from("%PDF-1.4 fake"))).rejects.toThrow();
  });

  it("recibo con importe con letra y leyenda de no CFDI", async () => {
    const r = await issueReceipt(T.ctx, { idempotencyKey: randomUUID(), brandId: T.brand.id, payerName: "José Pérez", concept: "Pago de mostrador", paymentMethod: "CASH", receivedAt: new Date(), currency: "MXN", amount: "1500" });
    const { buffer, filename } = await renderReceiptPdf(T.ctx, r.receipt.id);
    expect(filename).toBe(`Recibo_${r.receipt.folio}_Jose_Perez.pdf`);
    const t = pdfText(buffer);
    if (t) {
      expect(t.text).toContain("RECIBODEPAGO");
      expect(t.text).toContain("$1,500.00MXN");
      expect(t.text).toContain("MILQUINIENTOSPESOS00/100M.N.");
      expect(t.text).toContain("NosustituyeunCFDI");
    }
  });
});
