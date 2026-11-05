import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/session";
import { listBrands } from "@/features/brands/service";
import { PDF_TEMPLATES, PDF_TEMPLATE_LABEL, type PdfTemplate } from "@/features/brands/constants";
import { buttonClass } from "@/components/ui/button";
import { Card, Chip, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Plantillas" };

const DESC: Record<PdfTemplate, string> = {
  MINIMAL: "Tipografía cuidada, líneas finas y mucho aire. Sobrio y elegante.",
  CORPORATE: "Encabezado con tu color principal, tabla formal y total destacado.",
  CREATIVE: "Uso moderado de color con franja lateral y acentos, sin perder legibilidad.",
};

export default async function TemplatesPage() {
  const { ctx } = await requireTenant();
  const brands = await listBrands(ctx);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/ajustes", label: "Ajustes" }} title="Plantillas" subtitle="Elige el estilo predeterminado en cada marca; también puedes cambiarlo en cada cotización." />
      <div className="grid gap-4">
        {PDF_TEMPLATES.map((t) => (
          <Card key={t} className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold">{PDF_TEMPLATE_LABEL[t]}</h2>
              <p className="text-muted">{DESC[t]}</p>
            </div>
            <div className="flex flex-col gap-2">
              {brands.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-surface-muted p-2">
                  <span className="flex items-center gap-2 font-medium">
                    {b.name} {b.pdfTemplate === t ? <Chip tone="success">Predeterminada</Chip> : null}
                  </span>
                  <span className="flex gap-2">
                    <a className={buttonClass("secondary", "sm")} href={`/api/brands/${b.id}/preview?estilo=${t}`} target="_blank" rel="noopener">
                      Cotización
                    </a>
                    <a className={buttonClass("secondary", "sm")} href={`/api/brands/${b.id}/preview?tipo=recibo&estilo=${t}`} target="_blank" rel="noopener">
                      Recibo
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        Para cambiar la plantilla predeterminada, edita la marca en <Link className="text-link underline" href="/ajustes/marcas">Marcas</Link>.
      </p>
    </div>
  );
}
