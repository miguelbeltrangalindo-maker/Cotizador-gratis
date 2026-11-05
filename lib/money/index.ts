/**
 * Motor de cálculo monetario.
 *
 * POLÍTICA (documentada en docs/DECISIONES.md):
 * - Aritmética decimal exacta (decimal.js), nunca float para importes finales.
 * - Redondeo comercial HALF-UP a 2 decimales (centavos), POR LÍNEA. Los totales del
 *   documento son la suma de las líneas ya redondeadas. Editor, servidor y PDF usan
 *   exactamente estas funciones, por lo que el resultado es idéntico en los tres.
 * - Por línea:
 *     bruto      = round2(cantidad × precio unitario)
 *     descuento  = PERCENT: round2(bruto × % / 100) | FIXED: round2(valor) | NONE: 0
 *     tras desc. = bruto − descuento   (error si descuento > bruto)
 *     EXCLUSIVE: neto = tras desc.; impuesto = round2(neto × tasa); total = neto + impuesto
 *     INCLUSIVE: total = tras desc.; neto = round2(total / (1 + tasa)); impuesto = total − neto
 *     NONE:      neto = total = tras desc.; impuesto = 0
 * - Importes en unidades menores (centavos) como enteros.
 */
import Decimal from "decimal.js";

export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = Decimal;

export const CURRENCIES = ["MXN", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CURRENCY_LABEL: Record<Currency, string> = { MXN: "Peso mexicano", USD: "Dólar estadounidense" };

export const DISCOUNT_TYPES = ["NONE", "PERCENT", "FIXED"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export const TAX_MODES = ["NONE", "EXCLUSIVE", "INCLUSIVE"] as const;
export type TaxMode = (typeof TAX_MODES)[number];

/** Límites de seguridad para evitar valores inverosímiles o abuso. */
export const LIMITS = {
  maxQuantity: new Dec("10000000"), // 10 millones
  maxUnitPrice: new Dec("100000000000"), // 100 mil millones
  maxTaxRate: new Dec("100"),
  maxLineMinor: 9_000_000_000_000_00, // 9 billones en centavos (< 2^53)
  maxDecimals: 4,
};

export class MoneyError extends Error {
  constructor(
    public readonly code:
      | "INVALID_NUMBER"
      | "NEGATIVE"
      | "ZERO_QUANTITY"
      | "TOO_LARGE"
      | "TOO_MANY_DECIMALS"
      | "DISCOUNT_EXCEEDS"
      | "INVALID_RATE"
      | "INVALID_PERCENT",
    message: string,
  ) {
    super(message);
    this.name = "MoneyError";
  }
}

/**
 * Convierte texto/número a decimal estricto. Acepta "1,600.50" (separador de miles),
 * rechaza NaN, Infinity, notación científica y textos no numéricos.
 */
export function parseDecimal(input: string | number | Dec, field = "valor"): Dec {
  if (input instanceof Dec) {
    if (!input.isFinite()) throw new MoneyError("INVALID_NUMBER", `${field}: número inválido`);
    return input;
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new MoneyError("INVALID_NUMBER", `${field}: número inválido`);
    return new Dec(String(input));
  }
  const s = String(input).trim().replace(/,/g, "").replace(/^\$/, "");
  if (s === "" || !/^-?\d+(\.\d+)?$/.test(s) && !/^-?\.\d+$/.test(s)) {
    throw new MoneyError("INVALID_NUMBER", `${field}: escribe un número válido`);
  }
  const d = new Dec(s);
  if (!d.isFinite()) throw new MoneyError("INVALID_NUMBER", `${field}: número inválido`);
  return d;
}

function assertDecimals(d: Dec, field: string, max = LIMITS.maxDecimals) {
  if (d.decimalPlaces() > max) {
    throw new MoneyError("TOO_MANY_DECIMALS", `${field}: máximo ${max} decimales`);
  }
}

/** Redondea a centavos (HALF-UP) y devuelve entero de unidades menores. */
export function toMinor(amount: Dec): number {
  const cents = amount.times(100).toDecimalPlaces(0, Dec.ROUND_HALF_UP);
  if (cents.abs().greaterThan(LIMITS.maxLineMinor)) {
    throw new MoneyError("TOO_LARGE", "El importe excede el máximo permitido");
  }
  return cents.toNumber();
}

export function fromMinor(minor: number): Dec {
  return new Dec(minor).dividedBy(100);
}

export function minorToDecimalString(minor: number): string {
  return fromMinor(minor).toFixed(2);
}

/** Convierte un importe escrito por la persona (p. ej. "5,000.00") a centavos. */
export function parseAmountToMinor(input: string | number, field = "Importe"): number {
  const d = parseDecimal(input, field);
  assertDecimals(d, field, 2);
  if (d.isNegative()) throw new MoneyError("NEGATIVE", `${field}: no puede ser negativo`);
  return toMinor(d);
}

export interface LineInput {
  quantity: string | number;
  unitPrice: string | number;
  discountType?: DiscountType;
  discountValue?: string | number;
  taxMode?: TaxMode;
  /** Tasa en porcentaje, p. ej. 16 para 16 %. */
  taxRate?: string | number;
}

export interface LineResult {
  grossMinor: number;
  discountMinor: number;
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface NormalizedLine {
  quantity: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  taxMode: TaxMode;
  taxRate: string;
}

/** Valida y normaliza los valores de una línea (lanza MoneyError si son inválidos). */
export function normalizeLine(input: LineInput): NormalizedLine {
  const quantity = parseDecimal(input.quantity, "Cantidad");
  const unitPrice = parseDecimal(input.unitPrice, "Precio unitario");
  const discountType: DiscountType = input.discountType ?? "NONE";
  const taxMode: TaxMode = input.taxMode ?? "NONE";
  const discountValue = parseDecimal(input.discountValue ?? 0, "Descuento");
  const taxRate = taxMode === "NONE" ? new Dec(0) : parseDecimal(input.taxRate ?? 0, "Tasa de impuesto");

  assertDecimals(quantity, "Cantidad");
  assertDecimals(unitPrice, "Precio unitario");
  assertDecimals(discountValue, "Descuento");
  assertDecimals(taxRate, "Tasa de impuesto");

  if (quantity.isNegative()) throw new MoneyError("NEGATIVE", "Cantidad: no puede ser negativa");
  if (quantity.isZero()) throw new MoneyError("ZERO_QUANTITY", "Cantidad: debe ser mayor que cero");
  if (quantity.greaterThan(LIMITS.maxQuantity)) throw new MoneyError("TOO_LARGE", "Cantidad: valor demasiado grande");
  if (unitPrice.isNegative()) throw new MoneyError("NEGATIVE", "Precio unitario: no puede ser negativo");
  if (unitPrice.greaterThan(LIMITS.maxUnitPrice)) throw new MoneyError("TOO_LARGE", "Precio unitario: valor demasiado grande");
  if (discountValue.isNegative()) throw new MoneyError("NEGATIVE", "Descuento: no puede ser negativo");
  if (discountType === "PERCENT" && discountValue.greaterThan(100)) {
    throw new MoneyError("INVALID_PERCENT", "Descuento: el porcentaje no puede superar 100 %");
  }
  if (taxRate.isNegative() || taxRate.greaterThan(LIMITS.maxTaxRate)) {
    throw new MoneyError("INVALID_RATE", "Tasa de impuesto: debe estar entre 0 y 100 %");
  }
  return {
    quantity: quantity.toString(),
    unitPrice: unitPrice.toString(),
    discountType,
    discountValue: discountType === "NONE" ? "0" : discountValue.toString(),
    taxMode,
    taxRate: taxRate.toString(),
  };
}

/** Calcula una línea con la política documentada. */
export function computeLine(input: LineInput): LineResult {
  const n = normalizeLine(input);
  const quantity = new Dec(n.quantity);
  const unitPrice = new Dec(n.unitPrice);
  const grossMinor = toMinor(quantity.times(unitPrice));

  let discountMinor = 0;
  if (n.discountType === "PERCENT") {
    discountMinor = toMinor(fromMinor(grossMinor).times(n.discountValue).dividedBy(100));
  } else if (n.discountType === "FIXED") {
    discountMinor = toMinor(new Dec(n.discountValue));
  }
  if (discountMinor > grossMinor) {
    throw new MoneyError("DISCOUNT_EXCEEDS", "El descuento no puede ser mayor que el importe de la línea");
  }
  const afterDiscount = grossMinor - discountMinor;
  const rate = new Dec(n.taxRate).dividedBy(100);

  if (n.taxMode === "EXCLUSIVE") {
    const taxMinor = toMinor(fromMinor(afterDiscount).times(rate));
    return { grossMinor, discountMinor, netMinor: afterDiscount, taxMinor, totalMinor: afterDiscount + taxMinor };
  }
  if (n.taxMode === "INCLUSIVE") {
    const netMinor = toMinor(fromMinor(afterDiscount).dividedBy(rate.plus(1)));
    return { grossMinor, discountMinor, netMinor, taxMinor: afterDiscount - netMinor, totalMinor: afterDiscount };
  }
  return { grossMinor, discountMinor, netMinor: afterDiscount, taxMinor: 0, totalMinor: afterDiscount };
}

export interface TaxBreakdownRow {
  mode: Exclude<TaxMode, "NONE">;
  rate: string;
  baseMinor: number;
  taxMinor: number;
}

export interface DocumentTotals {
  grossMinor: number;
  discountMinor: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxBreakdown: TaxBreakdownRow[];
  hasInclusiveTax: boolean;
}

export function sumLines(lines: Array<LineResult & { taxMode?: TaxMode; taxRate?: string | number }>): DocumentTotals {
  const totals: DocumentTotals = {
    grossMinor: 0,
    discountMinor: 0,
    subtotalMinor: 0,
    taxMinor: 0,
    totalMinor: 0,
    taxBreakdown: [],
    hasInclusiveTax: false,
  };
  const breakdown = new Map<string, TaxBreakdownRow>();
  for (const l of lines) {
    totals.grossMinor += l.grossMinor;
    totals.discountMinor += l.discountMinor;
    totals.subtotalMinor += l.netMinor;
    totals.taxMinor += l.taxMinor;
    totals.totalMinor += l.totalMinor;
    if (l.taxMode && l.taxMode !== "NONE") {
      if (l.taxMode === "INCLUSIVE") totals.hasInclusiveTax = true;
      const rate = new Dec(l.taxRate ?? 0).toString();
      const key = `${l.taxMode}:${rate}`;
      const row = breakdown.get(key) ?? { mode: l.taxMode, rate, baseMinor: 0, taxMinor: 0 };
      row.baseMinor += l.netMinor;
      row.taxMinor += l.taxMinor;
      breakdown.set(key, row);
    }
  }
  totals.taxBreakdown = [...breakdown.values()].sort((a, b) => new Dec(b.rate).comparedTo(new Dec(a.rate)));
  return totals;
}

/** Calcula todas las líneas y los totales del documento. */
export function computeDocument(lines: LineInput[]): { lines: LineResult[]; totals: DocumentTotals } {
  const results = lines.map((l) => computeLine(l));
  const totals = sumLines(
    results.map((r, i) => ({ ...r, taxMode: lines[i].taxMode ?? "NONE", taxRate: lines[i].taxRate ?? 0 })),
  );
  return { lines: results, totals };
}

// ---------------------------------------------------------------------------
// Recibos: tratamiento informativo de IVA
// ---------------------------------------------------------------------------

export const RECEIPT_TAX_TREATMENTS = ["NONE", "INCLUDED", "ADDED"] as const;
export type ReceiptTaxTreatment = (typeof RECEIPT_TAX_TREATMENTS)[number];

/**
 * - NONE: el importe es el total recibido, sin desglose.
 * - INCLUDED: el importe recibido ya incluye IVA; se desglosa neto e IVA.
 * - ADDED: el importe capturado es la base; se suma IVA y el total recibido es base + IVA.
 * Devuelve siempre `amountMinor` = total efectivamente recibido.
 */
export function computeReceiptAmounts(
  enteredMinor: number,
  treatment: ReceiptTaxTreatment,
  taxRate: string | number,
): { amountMinor: number; netMinor: number; taxMinor: number } {
  if (!Number.isInteger(enteredMinor) || enteredMinor <= 0) {
    throw new MoneyError("NEGATIVE", "El importe debe ser mayor que cero");
  }
  if (treatment === "NONE") return { amountMinor: enteredMinor, netMinor: enteredMinor, taxMinor: 0 };
  const rateDec = parseDecimal(taxRate, "Tasa de IVA");
  if (rateDec.isNegative() || rateDec.greaterThan(100)) {
    throw new MoneyError("INVALID_RATE", "Tasa de IVA: debe estar entre 0 y 100 %");
  }
  const rate = rateDec.dividedBy(100);
  if (treatment === "INCLUDED") {
    const netMinor = toMinor(fromMinor(enteredMinor).dividedBy(rate.plus(1)));
    return { amountMinor: enteredMinor, netMinor, taxMinor: enteredMinor - netMinor };
  }
  const taxMinor = toMinor(fromMinor(enteredMinor).times(rate));
  return { amountMinor: enteredMinor + taxMinor, netMinor: enteredMinor, taxMinor };
}

// ---------------------------------------------------------------------------
// Saldos
// ---------------------------------------------------------------------------

export type PaymentStatus = "NOT_APPLICABLE" | "UNPAID" | "PARTIALLY_PAID" | "PAID";

export interface BalanceInput {
  /** Total de la versión de referencia; null si la cotización aún no tiene importe exigible. */
  baseTotalMinor: number | null;
  receipts: Array<{ amountMinor: number; status: "ISSUED" | "VOID" }>;
}

export interface BalanceResult {
  baseTotalMinor: number | null;
  paidMinor: number;
  balanceMinor: number;
  status: PaymentStatus;
}

/** Saldo = max(0, base − pagado). Los recibos ANULADOS nunca cuentan. */
export function calculatePaidAndBalance(input: BalanceInput): BalanceResult {
  const paidMinor = input.receipts.filter((r) => r.status === "ISSUED").reduce((s, r) => s + r.amountMinor, 0);
  if (input.baseTotalMinor === null) {
    return { baseTotalMinor: null, paidMinor, balanceMinor: 0, status: "NOT_APPLICABLE" };
  }
  const balanceMinor = Math.max(0, input.baseTotalMinor - paidMinor);
  let status: PaymentStatus = "UNPAID";
  if (paidMinor > 0 && balanceMinor > 0) status = "PARTIALLY_PAID";
  if (balanceMinor === 0 && (paidMinor > 0 || input.baseTotalMinor === 0)) status = "PAID";
  return { baseTotalMinor: input.baseTotalMinor, paidMinor, balanceMinor, status };
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  NOT_APPLICABLE: "Sin saldo exigible",
  UNPAID: "Pendiente de pago",
  PARTIALLY_PAID: "Parcialmente pagada",
  PAID: "Pagada",
};

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

const formatters = new Map<string, Intl.NumberFormat>();
function nf(): Intl.NumberFormat {
  const key = "es-MX";
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formatters.set(key, f);
  }
  return f;
}

/** "$1,600.00 USD" — siempre con código ISO para evitar ambigüedad. */
export function formatMoney(minor: number, currency: string): string {
  const neg = minor < 0;
  const abs = fromMinor(Math.abs(minor));
  // Intl recibe un número de 2 decimales exactos, sin pérdida relevante para formateo.
  const s = nf().format(Number(abs.toFixed(2)));
  return `${neg ? "−" : ""}$${s} ${currency}`;
}

/** Formatea un decimal (cantidad, precio unitario) sin ceros sobrantes, mínimo 2 decimales para precios. */
export function formatDecimal(value: string, minDecimals = 0): string {
  const d = new Dec(value || 0);
  const decimals = Math.max(minDecimals, Math.min(d.decimalPlaces(), 4));
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(d.toFixed(decimals)));
}

export function formatUnitPrice(value: string, currency: string): string {
  return `$${formatDecimal(value, 2)} ${currency}`;
}

export function formatPercent(rate: string): string {
  return `${formatDecimal(rate)} %`;
}

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}
