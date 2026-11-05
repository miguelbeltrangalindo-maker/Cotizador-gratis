import { describe, expect, it } from "vitest";
import {
  calculatePaidAndBalance,
  computeDocument,
  computeLine,
  computeReceiptAmounts,
  formatMoney,
  MoneyError,
  parseAmountToMinor,
  parseDecimal,
} from "@/lib/money";

describe("motor de dinero — casos obligatorios", () => {
  it("3 × 300 USD = 900 USD", () => {
    expect(computeLine({ quantity: 3, unitPrice: 300 }).totalMinor).toBe(90000);
  });
  it("2 × 350 USD = 700 USD", () => {
    expect(computeLine({ quantity: 2, unitPrice: "350" }).totalMinor).toBe(70000);
  });
  it("total 1,600 USD antes de IVA; IVA exclusive 16 % = 256; total 1,856", () => {
    const sinIva = computeDocument([
      { quantity: 3, unitPrice: 300 },
      { quantity: 2, unitPrice: 350 },
    ]);
    expect(sinIva.totals.totalMinor).toBe(160000);
    const conIva = computeDocument([
      { quantity: 3, unitPrice: 300, taxMode: "EXCLUSIVE", taxRate: 16 },
      { quantity: 2, unitPrice: 350, taxMode: "EXCLUSIVE", taxRate: 16 },
    ]);
    expect(conIva.totals.subtotalMinor).toBe(160000);
    expect(conIva.totals.taxMinor).toBe(25600);
    expect(conIva.totals.totalMinor).toBe(185600);
    expect(conIva.totals.taxBreakdown).toEqual([{ mode: "EXCLUSIVE", rate: "16", baseMinor: 160000, taxMinor: 25600 }]);
  });
  it("IVA INCLUSIVE 16 % con bruto 1,160 MXN => neto 1,000 e IVA 160", () => {
    const r = computeLine({ quantity: 1, unitPrice: 1160, taxMode: "INCLUSIVE", taxRate: 16 });
    expect(r).toMatchObject({ netMinor: 100000, taxMinor: 16000, totalMinor: 116000 });
  });
  it("descuento 10 % sobre 1,000 = 900 antes de impuesto (exclusive)", () => {
    const r = computeLine({
      quantity: 1,
      unitPrice: 1000,
      discountType: "PERCENT",
      discountValue: 10,
      taxMode: "EXCLUSIVE",
      taxRate: 16,
    });
    expect(r.discountMinor).toBe(10000);
    expect(r.netMinor).toBe(90000);
    expect(r.taxMinor).toBe(14400);
    expect(r.totalMinor).toBe(104400);
  });
  it("descuento fijo", () => {
    const r = computeLine({ quantity: 2, unitPrice: 100, discountType: "FIXED", discountValue: "50.5" });
    expect(r.netMinor).toBe(14950);
  });
  it("cantidad decimal 1.5 × 200 = 300", () => {
    expect(computeLine({ quantity: "1.5", unitPrice: 200 }).totalMinor).toBe(30000);
  });
  it("importe cero (cortesía) se respeta", () => {
    const r = computeLine({ quantity: 1, unitPrice: 0, taxMode: "EXCLUSIVE", taxRate: 16 });
    expect(r).toEqual({ grossMinor: 0, discountMinor: 0, netMinor: 0, taxMinor: 0, totalMinor: 0 });
  });
  it("descuento mayor a la línea: error validado", () => {
    expect(() => computeLine({ quantity: 1, unitPrice: 100, discountType: "FIXED", discountValue: 101 })).toThrow(
      MoneyError,
    );
    expect(() => computeLine({ quantity: 1, unitPrice: 100, discountType: "PERCENT", discountValue: 101 })).toThrow(
      /porcentaje/,
    );
  });
  it("cambio de moneda no convierte importes (el cálculo no depende de la moneda)", () => {
    const a = computeDocument([{ quantity: 3, unitPrice: 300 }]).totals.totalMinor;
    expect(a).toBe(90000);
    expect(formatMoney(a, "USD")).toBe("$900.00 USD");
    expect(formatMoney(a, "MXN")).toBe("$900.00 MXN");
  });
});

describe("redondeo y precisión", () => {
  it("evita errores de float: 0.1 × 3 = 0.30", () => {
    expect(computeLine({ quantity: 3, unitPrice: "0.1" }).totalMinor).toBe(30);
  });
  it("HALF-UP por línea: 1 × 0.005 = 0.01", () => {
    expect(computeLine({ quantity: 1, unitPrice: "0.005" }).totalMinor).toBe(1);
  });
  it("IVA con redondeo: 33.33 × 16 % = 5.33", () => {
    expect(computeLine({ quantity: 1, unitPrice: "33.33", taxMode: "EXCLUSIVE", taxRate: 16 }).taxMinor).toBe(533);
  });
  it("inclusive con redondeo: 100 incl. 16 % => neto 86.21, IVA 13.79", () => {
    const r = computeLine({ quantity: 1, unitPrice: 100, taxMode: "INCLUSIVE", taxRate: 16 });
    expect(r.netMinor).toBe(8621);
    expect(r.taxMinor).toBe(1379);
    expect(r.netMinor + r.taxMinor).toBe(r.totalMinor);
  });
  it("precio unitario de 4 decimales", () => {
    expect(computeLine({ quantity: 1000, unitPrice: "1.2345" }).totalMinor).toBe(123450);
  });
  it("tax_mode NONE ignora tasa", () => {
    expect(computeLine({ quantity: 1, unitPrice: 100, taxMode: "NONE", taxRate: 16 }).taxMinor).toBe(0);
  });
  it("mezcla de tasas genera desglose por tasa", () => {
    const d = computeDocument([
      { quantity: 1, unitPrice: 100, taxMode: "EXCLUSIVE", taxRate: 16 },
      { quantity: 1, unitPrice: 100, taxMode: "EXCLUSIVE", taxRate: 8 },
      { quantity: 1, unitPrice: 100 },
    ]);
    expect(d.totals.taxBreakdown.map((t) => t.rate)).toEqual(["16", "8"]);
    expect(d.totals.totalMinor).toBe(32400);
  });
});

describe("validaciones de entrada", () => {
  it.each([["abc"], [""], ["1e5"], ["NaN"], ["Infinity"], ["--1"]])("rechaza %s", (v) => {
    expect(() => parseDecimal(v)).toThrow(MoneyError);
  });
  it("rechaza números no finitos", () => {
    expect(() => parseDecimal(Number.NaN)).toThrow(MoneyError);
    expect(() => parseDecimal(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
  it("acepta separadores de miles", () => {
    expect(parseDecimal("1,600.50").toString()).toBe("1600.5");
  });
  it("rechaza cantidades negativas o cero", () => {
    expect(() => computeLine({ quantity: -1, unitPrice: 1 })).toThrow(/negativa/);
    expect(() => computeLine({ quantity: 0, unitPrice: 1 })).toThrow(/mayor que cero/);
  });
  it("rechaza precios negativos y tasas inverosímiles", () => {
    expect(() => computeLine({ quantity: 1, unitPrice: -5 })).toThrow(MoneyError);
    expect(() => computeLine({ quantity: 1, unitPrice: 5, taxMode: "EXCLUSIVE", taxRate: 150 })).toThrow(/Tasa/);
  });
  it("rechaza más de 4 decimales", () => {
    expect(() => computeLine({ quantity: "1.12345", unitPrice: 1 })).toThrow(/decimales/);
  });
  it("rechaza valores gigantes", () => {
    expect(() => computeLine({ quantity: "99999999", unitPrice: 1 })).toThrow(/grande/);
  });
  it("importe de recibo: máximo 2 decimales y no negativo", () => {
    expect(parseAmountToMinor("5,000.00")).toBe(500000);
    expect(() => parseAmountToMinor("1.005")).toThrow(/decimales/);
    expect(() => parseAmountToMinor("-1")).toThrow(/negativo/);
  });
});

describe("recibos — tratamiento de IVA", () => {
  it("sin IVA", () => {
    expect(computeReceiptAmounts(150000, "NONE", 16)).toEqual({ amountMinor: 150000, netMinor: 150000, taxMinor: 0 });
  });
  it("incluye IVA: 1,160 => neto 1,000 + IVA 160", () => {
    expect(computeReceiptAmounts(116000, "INCLUDED", 16)).toEqual({ amountMinor: 116000, netMinor: 100000, taxMinor: 16000 });
  });
  it("más IVA: base 1,000 => total recibido 1,160", () => {
    expect(computeReceiptAmounts(100000, "ADDED", 16)).toEqual({ amountMinor: 116000, netMinor: 100000, taxMinor: 16000 });
  });
  it("rechaza cero o negativo", () => {
    expect(() => computeReceiptAmounts(0, "NONE", 0)).toThrow();
    expect(() => computeReceiptAmounts(-1, "NONE", 0)).toThrow();
  });
});

describe("saldos", () => {
  it("10,000 − 5,000 − 3,000 = 2,000 (parcialmente pagada)", () => {
    const r = calculatePaidAndBalance({
      baseTotalMinor: 1000000,
      receipts: [
        { amountMinor: 500000, status: "ISSUED" },
        { amountMinor: 300000, status: "ISSUED" },
      ],
    });
    expect(r).toEqual({ baseTotalMinor: 1000000, paidMinor: 800000, balanceMinor: 200000, status: "PARTIALLY_PAID" });
  });
  it("los recibos anulados no cuentan", () => {
    const r = calculatePaidAndBalance({
      baseTotalMinor: 1000000,
      receipts: [
        { amountMinor: 500000, status: "ISSUED" },
        { amountMinor: 300000, status: "VOID" },
      ],
    });
    expect(r.balanceMinor).toBe(500000);
  });
  it("saldo cero => pagada; sin pagos => pendiente", () => {
    expect(calculatePaidAndBalance({ baseTotalMinor: 100, receipts: [{ amountMinor: 100, status: "ISSUED" }] }).status).toBe(
      "PAID",
    );
    expect(calculatePaidAndBalance({ baseTotalMinor: 100, receipts: [] }).status).toBe("UNPAID");
  });
  it("borrador sin importe final: no hay saldo exigible", () => {
    expect(calculatePaidAndBalance({ baseTotalMinor: null, receipts: [] }).status).toBe("NOT_APPLICABLE");
  });
  it("saldo nunca negativo", () => {
    expect(calculatePaidAndBalance({ baseTotalMinor: 100, receipts: [{ amountMinor: 150, status: "ISSUED" }] }).balanceMinor).toBe(0);
  });
});

describe("formato", () => {
  it("siempre muestra el código ISO", () => {
    expect(formatMoney(185600 * 1, "USD")).toBe("$1,856.00 USD");
    expect(formatMoney(100000000, "MXN")).toBe("$1,000,000.00 MXN");
  });
});
