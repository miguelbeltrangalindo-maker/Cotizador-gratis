import { Download, ExternalLink } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Alert, PageHeader } from "@/components/ui/misc";

/** Vista previa real del PDF (el mismo archivo que se descarga), en escritorio y móvil. */
export function PdfPreview({ title, back, src, draft }: { title: string; back: { href: string; label: string }; src: string; draft?: boolean }) {
  const join = src.includes("?") ? "&" : "?";
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={back}
        title={title}
        actions={
          <>
            <a href={`${src}${join}descargar=1`} className={buttonClass("primary")}>
              <Download size={18} aria-hidden /> Descargar
            </a>
            <a href={src} target="_blank" rel="noopener" className={buttonClass("secondary")}>
              <ExternalLink size={18} aria-hidden /> Abrir en pestaña
            </a>
          </>
        }
      />
      {draft ? <Alert tone="warning">Es un borrador: el PDF muestra la leyenda “BORRADOR” y no tiene folio hasta marcarla como enviada.</Alert> : null}
      <p className="text-sm text-muted lg:hidden">En algunos teléfonos la vista integrada muestra solo la primera página: usa “Abrir en pestaña” para verlo completo.</p>
      <iframe src={src} title={`Vista previa PDF ${title}`} className="h-[75dvh] w-full rounded-[var(--radius)] border border-border bg-white" />
    </div>
  );
}
