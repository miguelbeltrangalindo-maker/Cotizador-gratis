import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireTenant } from "@/lib/session";
import { assertCan } from "@/lib/security/tenant";
import { buttonClass } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Datos" };

export default async function DataPage() {
  const { ctx } = await requireTenant();
  assertCan(ctx, "data.export");
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: "/ajustes", label: "Ajustes" }} title="Datos" subtitle="Exporta tu información en CSV (UTF-8) para respaldo o portabilidad. Solo incluye datos de esta organización." />
      <Card className="flex flex-col gap-3">
        {[
          ["clientes", "Clientes"],
          ["cotizaciones", "Cotizaciones (todas las versiones)"],
          ["recibos", "Recibos (incluye anulados)"],
        ].map(([k, label]) => (
          <a key={k} href={`/api/export/${k}`} className={buttonClass("secondary", "md", "justify-between")}>
            {label} <Download size={18} aria-hidden />
          </a>
        ))}
        <p className="text-xs text-muted">No se exportan contraseñas, sesiones, datos bancarios ni notas internas.</p>
      </Card>
    </div>
  );
}
