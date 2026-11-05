/** Máquina de estados comerciales de una versión de cotización (función pura). */
export const QUOTE_STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
};

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["APPROVED", "REJECTED", "EXPIRED"],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: [],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: QuoteStatus): QuoteStatus[] {
  return TRANSITIONS[from];
}

/** Una versión enviada con vigencia vencida se muestra como "Vencida" aunque no se haya marcado. */
export function displayStatus(status: QuoteStatus, validUntil: string | null, today: string): QuoteStatus {
  if (status === "SENT" && validUntil && validUntil < today) return "EXPIRED";
  return status;
}

export function isEditable(status: QuoteStatus): boolean {
  return status === "DRAFT";
}
