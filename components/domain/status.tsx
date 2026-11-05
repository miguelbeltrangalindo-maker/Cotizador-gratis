import { Chip } from "@/components/ui/misc";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "@/features/quotes/status";
import { PAYMENT_STATUS_LABEL, type PaymentStatus } from "@/lib/money";

const QUOTE_TONE: Record<QuoteStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SENT: "info",
  APPROVED: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
};
const QUOTE_ICON: Record<QuoteStatus, string> = { DRAFT: "✎", SENT: "➚", APPROVED: "✓", REJECTED: "✕", EXPIRED: "⏱" };

/** El estado se comunica con texto e ícono, no solo con color. */
export function QuoteStatusChip({ status }: { status: QuoteStatus }) {
  return (
    <Chip tone={QUOTE_TONE[status]}>
      <span aria-hidden>{QUOTE_ICON[status]}</span> {QUOTE_STATUS_LABEL[status]}
    </Chip>
  );
}

const PAY_TONE: Record<PaymentStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  NOT_APPLICABLE: "neutral",
  UNPAID: "warning",
  PARTIALLY_PAID: "info",
  PAID: "success",
};

export function PaymentStatusChip({ status }: { status: PaymentStatus }) {
  return <Chip tone={PAY_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Chip>;
}

export function ReceiptStatusChip({ status }: { status: string }) {
  return status === "VOID" ? (
    <Chip tone="danger">
      <span aria-hidden>✕</span> Anulado
    </Chip>
  ) : (
    <Chip tone="success">
      <span aria-hidden>✓</span> Emitido
    </Chip>
  );
}
