"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Copy, Download, Eye, FilePlus2, Pencil, Share2 } from "lucide-react";
import { archiveQuoteAction, changeQuoteStatusAction, createQuoteVersionAction, duplicateQuoteAction } from "@/features/quotes/actions";
import { allowedTransitions, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/features/quotes/status";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/client";

const ACTION_LABEL: Partial<Record<QuoteStatus, string>> = {
  SENT: "Marcar enviada",
  APPROVED: "Marcar aprobada",
  REJECTED: "Marcar rechazada",
  EXPIRED: "Marcar vencida",
};

export function QuoteActions({
  quoteId,
  status,
  isCurrent,
  versionNumber,
  archived,
  pdfUrl,
  canPay,
  filenameHint,
}: {
  quoteId: string;
  status: QuoteStatus;
  isCurrent: boolean;
  versionNumber: number;
  archived: boolean;
  pdfUrl: string;
  canPay: boolean;
  filenameHint: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; message?: string } | undefined | void>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res && !res.ok) setError(res.message ?? "No fue posible completar la acción.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setError(null);
    try {
      const res = await fetch(`${pdfUrl}&descargar=1`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `Cotizacion_${filenameHint}.pdf`;
      const file = new File([blob], name, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
      else window.open(`${pdfUrl}&descargar=1`, "_self");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError("No se pudo compartir. Usa Descargar.");
    }
  }

  const transitions = isCurrent && !archived ? allowedTransitions(status).filter((t) => t !== "SENT") : [];
  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {isCurrent && status === "DRAFT" && !archived ? (
          <ButtonLink href={`/cotizaciones/${quoteId}/editar`}>
            <Pencil size={18} aria-hidden /> Continuar editando
          </ButtonLink>
        ) : null}
        <ButtonLink href={`/cotizaciones/${quoteId}/vista-previa?v=${versionNumber}`} variant="secondary">
          <Eye size={18} aria-hidden /> Vista previa
        </ButtonLink>
        <a href={`${pdfUrl}&descargar=1`} className={buttonClass("secondary")}>
          <Download size={18} aria-hidden /> Descargar PDF
        </a>
        <Button variant="secondary" onClick={share}>
          <Share2 size={18} aria-hidden /> Compartir
        </Button>
      </div>
      {transitions.length || (isCurrent && status !== "DRAFT") || canPay ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {transitions.map((t) => (
            <ConfirmDialog
              key={t}
              title={`¿${ACTION_LABEL[t]}?`}
              description={`El estado de la versión ${versionNumber} cambiará a “${QUOTE_STATUS_LABEL[t]}”. Quedará registrado en la auditoría.`}
              confirmLabel={ACTION_LABEL[t]}
              tone={t === "APPROVED" ? "primary" : "danger"}
              onConfirm={() => run(() => changeQuoteStatusAction(quoteId, t))}
              trigger={(open) => (
                <Button variant={t === "APPROVED" ? "primary" : "secondary"} onClick={open} disabled={busy}>
                  {ACTION_LABEL[t]}
                </Button>
              )}
            />
          ))}
          {isCurrent && status !== "DRAFT" && !archived ? (
            <ConfirmDialog
              title="¿Crear una nueva versión?"
              description={`Se copiará la versión ${versionNumber} como un borrador editable. La versión ${versionNumber} se conserva sin cambios.`}
              confirmLabel="Crear versión"
              tone="primary"
              onConfirm={() => run(() => createQuoteVersionAction(quoteId))}
              trigger={(open) => (
                <Button variant="secondary" onClick={open} disabled={busy}>
                  <FilePlus2 size={18} aria-hidden /> Nueva versión
                </Button>
              )}
            />
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => run(() => duplicateQuoteAction(quoteId, versionNumber))} disabled={busy}>
          <Copy size={16} aria-hidden /> Duplicar como nueva cotización
        </Button>
        <ConfirmDialog
          title={archived ? "¿Restaurar cotización?" : "¿Archivar cotización?"}
          description={archived ? "Volverá a aparecer en el historial activo." : "Se ocultará del historial activo. No se borra nada y puedes restaurarla."}
          confirmLabel={archived ? "Restaurar" : "Archivar"}
          tone="primary"
          onConfirm={() => run(() => archiveQuoteAction(quoteId, !archived))}
          trigger={(open) => (
            <Button variant="ghost" size="sm" onClick={open} disabled={busy}>
              <Archive size={16} aria-hidden /> {archived ? "Restaurar" : "Archivar"}
            </Button>
          )}
        />
      </div>
    </div>
  );
}
