"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { voidReceiptAction } from "@/features/receipts/actions";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/client";

export function VoidReceiptButton({ receiptId, folio }: { receiptId: string; folio: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      title={`¿Anular el recibo ${folio}?`}
      description="El recibo no se borra: queda marcado como anulado con su motivo y deja de contar para el saldo. Esta acción no se puede deshacer; si fue un error, emite un recibo nuevo."
      confirmLabel="Anular recibo"
      onConfirm={async () => {
        setError(null);
        const res = await voidReceiptAction(receiptId, reason);
        if (!res.ok) {
          setError(res.message);
          throw new Error(res.message);
        }
        router.refresh();
      }}
      trigger={(open) => (
        <Button variant="secondary" className="text-danger" onClick={open}>
          Anular
        </Button>
      )}
    >
      <Field label="Motivo de la anulación" htmlFor="void-reason" required>
        <Textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </ConfirmDialog>
  );
}
