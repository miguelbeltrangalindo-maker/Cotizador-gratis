"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { archiveCatalogItemAction, saveCatalogItemAction } from "@/features/catalog/actions";
import { UNITS } from "@/features/catalog/constants";
import { formatUnitPrice, formatPercent } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card, Chip, EmptyState } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/client";

interface Row {
  id: string;
  title: string;
  description: string | null;
  unit: string | null;
  suggestedPrice: string;
  currency: string;
  taxMode: string;
  taxRate: string;
  brandId: string | null;
  archived: boolean;
}

export function CatalogManager({ rows, brands, canManage }: { rows: Row[]; brands: Array<{ id: string; name: string }>; canManage: boolean }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4">
      {editing ? (
        <ItemForm key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} brands={brands} onDone={() => setEditing(null)} />
      ) : (
        <Button className="w-fit" onClick={() => setEditing("new")}>
          Nuevo concepto
        </Button>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Sin conceptos" description="Crea servicios o productos que uses seguido para insertarlos en segundos." />
      ) : (
        <ul className="card divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-anywhere font-medium">{r.title}</p>
                {r.description ? <p className="line-clamp-2 break-anywhere text-sm text-muted">{r.description}</p> : null}
                <p className="text-sm text-muted">
                  {formatUnitPrice(r.suggestedPrice, r.currency)}
                  {r.unit ? ` / ${r.unit}` : ""} · {r.taxMode === "NONE" ? "Sin IVA" : `IVA ${formatPercent(r.taxRate)}${r.taxMode === "INCLUSIVE" ? " incluido" : ""}`}
                  {r.brandId ? ` · ${brands.find((b) => b.id === r.brandId)?.name ?? ""}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.archived ? <Chip tone="warning">Archivado</Chip> : null}
                {canManage ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await archiveCatalogItemAction(r.id, !r.archived);
                        router.refresh();
                      }}
                    >
                      {r.archived ? "Restaurar" : "Archivar"}
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemForm({ row, brands, onDone }: { row: Row | null; brands: Array<{ id: string; name: string }>; onDone: () => void }) {
  const [state, action] = useActionState(saveCatalogItemAction.bind(null, row?.id ?? null), null);
  const [taxMode, setTaxMode] = useState(row?.taxMode ?? "EXCLUSIVE");
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <Card>
      <form action={action} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{row ? "Editar concepto" : "Nuevo concepto"}</h2>
        {state && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
        <Field label="Nombre del concepto" htmlFor="ci-title" required error={fe.title}>
          <Input id="ci-title" name="title" defaultValue={row?.title} maxLength={300} required />
        </Field>
        <Field label="Descripción reutilizable" htmlFor="ci-desc">
          <Textarea id="ci-desc" name="description" defaultValue={row?.description ?? ""} rows={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Unidad sugerida" htmlFor="ci-unit">
            <Input id="ci-unit" name="unit" list="ci-units" defaultValue={row?.unit ?? ""} maxLength={40} />
            <datalist id="ci-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          <Field label="Precio sugerido" htmlFor="ci-price" error={fe.suggestedPrice}>
            <Input id="ci-price" name="suggestedPrice" inputMode="decimal" defaultValue={row ? row.suggestedPrice.replace(/\.?0+$/, "") : ""} />
          </Field>
          <Field label="Moneda" htmlFor="ci-cur">
            <Select id="ci-cur" name="currency" defaultValue={row?.currency ?? "MXN"}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
          <Field label="IVA sugerido" htmlFor="ci-tax">
            <Select id="ci-tax" name="taxMode" value={taxMode} onChange={(e) => setTaxMode(e.target.value)}>
              <option value="EXCLUSIVE">Más IVA</option>
              <option value="INCLUSIVE">IVA incluido</option>
              <option value="NONE">Sin IVA</option>
            </Select>
          </Field>
          {taxMode !== "NONE" ? (
            <Field label="Tasa (%)" htmlFor="ci-rate">
              <Input id="ci-rate" name="taxRate" inputMode="decimal" defaultValue={row ? row.taxRate.replace(/\.?0+$/, "") : "16"} />
            </Field>
          ) : (
            <input type="hidden" name="taxRate" value="0" />
          )}
          {brands.length > 1 ? (
            <Field label="Marca" htmlFor="ci-brand">
              <Select id="ci-brand" name="brandId" defaultValue={row?.brandId ?? ""}>
                <option value="">Todas las marcas</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
        <div className="flex gap-2">
          <SubmitButton>Guardar</SubmitButton>
          <Button variant="secondary" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
