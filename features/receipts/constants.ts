export const PAYMENT_METHODS = ["TRANSFER", "CASH", "CARD", "CHECK", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  CARD: "Tarjeta",
  CHECK: "Cheque",
  OTHER: "Otro",
};
export const TAX_TREATMENT_LABEL = { NONE: "Sin IVA", INCLUDED: "Incluye IVA", ADDED: "Más IVA" } as const;
