import type { Metadata } from "next";
import { requireTenant } from "@/lib/session";
import { assertCan } from "@/lib/security/tenant";
import { listCustomFields } from "@/features/custom-fields/service";
import { PageHeader } from "@/components/ui/misc";
import { CustomFieldsManager } from "./manager";

export const metadata: Metadata = { title: "Campos personalizados" };

export default async function CustomFieldsPage() {
  const { ctx } = await requireTenant();
  assertCan(ctx, "customFields.manage");
  const fields = await listCustomFields(ctx, true);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ href: "/ajustes", label: "Ajustes" }}
        title="Campos personalizados"
        subtitle="Agrega información extra a tus cotizaciones (p. ej. “Número de orden”, “Fecha del evento”). Cada cotización guarda la definición con la que se llenó."
      />
      <CustomFieldsManager
        fields={fields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type as never,
          options: f.optionsJson ?? [],
          required: f.required,
          visibleInPdf: f.visibleInPdf,
          sortOrder: f.sortOrder,
          archived: Boolean(f.archivedAt),
        }))}
      />
    </div>
  );
}
