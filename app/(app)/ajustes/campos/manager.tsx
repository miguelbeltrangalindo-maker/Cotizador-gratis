"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveCustomFieldAction, saveCustomFieldAction, type CustomFieldForm } from "@/features/custom-fields/actions";
import { CUSTOM_FIELD_TYPE_LABEL, CUSTOM_FIELD_TYPES, type CustomFieldType } from "@/features/custom-fields/constants";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card, Chip } from "@/components/ui/misc";

interface Row extends CustomFieldForm {
  id: string;
  archived: boolean;
}

const EMPTY: CustomFieldForm = { label: "", type: "short_text", options: [], required: false, visibleInPdf: true, sortOrder: 0 };

export function CustomFieldsManager({ fields }: { fields: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CustomFieldForm>(EMPTY);
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function edit(r: Row | null) {
    setError(null);
    setEditing(r?.id ?? "new");
    setForm(r ? { label: r.label, type: r.type, options: r.options, required: r.required, visibleInPdf: r.visibleInPdf, sortOrder: r.sortOrder } : { ...EMPTY, sortOrder: fields.length });
    setOptionsText((r?.options ?? []).join("\n"));
  }

  async function save() {
    const res = await saveCustomFieldAction(editing === "new" ? null : editing, {
      ...form,
      options: optionsText.split("\n").map((s) => s.trim()).filter(Boolean),
    });
    if (!res.ok) return setError(res.message);
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="card divide-y divide-border">
        {fields.length === 0 ? <li className="p-4 text-muted">Aún no hay campos personalizados.</li> : null}
        {fields.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <p className="font-medium">
                {f.label} {f.required ? <span className="text-danger">*</span> : null}
              </p>
              <p className="text-sm text-muted">
                {CUSTOM_FIELD_TYPE_LABEL[f.type]} · {f.visibleInPdf ? "Visible en PDF" : "Solo interno"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {f.archived ? <Chip tone="warning">Archivado</Chip> : null}
              <Button variant="ghost" size="sm" onClick={() => edit(f)}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await archiveCustomFieldAction(f.id, !f.archived);
                  router.refresh();
                }}
              >
                {f.archived ? "Restaurar" : "Archivar"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{editing === "new" ? "Nuevo campo" : "Editar campo"}</h2>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="Etiqueta" htmlFor="cf-label">
            <Input id="cf-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Tipo" htmlFor="cf-type">
            <Select id="cf-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CustomFieldType })}>
              {CUSTOM_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CUSTOM_FIELD_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          {form.type === "select" ? (
            <Field label="Opciones (una por línea)" htmlFor="cf-options">
              <Textarea id="cf-options" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={4} />
            </Field>
          ) : null}
          <Field label="Orden" htmlFor="cf-order">
            <Input id="cf-order" inputMode="numeric" value={String(form.sortOrder)} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
          </Field>
          <Checkbox id="cf-req" label="Obligatorio para enviar la cotización" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
          <Checkbox id="cf-pdf" label="Mostrar en el PDF" checked={form.visibleInPdf} onChange={(e) => setForm({ ...form, visibleInPdf: e.target.checked })} />
          <div className="flex gap-2">
            <Button onClick={save}>Guardar campo</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </Card>
      ) : (
        <Button onClick={() => edit(null)} className="w-fit">
          Agregar campo
        </Button>
      )}
    </div>
  );
}
