"use client";

import { memo, useState, type Dispatch } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, BookmarkPlus, ChevronDown, Copy, GripVertical, Trash2 } from "lucide-react";
import type { EditorAction } from "@/features/quotes/editor-state";
import type { DraftItem } from "@/features/quotes/schema";
import { UNITS } from "@/features/catalog/constants";
import { saveLineToCatalogAction } from "@/features/catalog/actions";
import { computeLine, formatMoney } from "@/lib/money";
import { buttonClass } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/client";

function amountOf(item: DraftItem): { amount: number; total: number } | null {
  try {
    const r = computeLine(item);
    return { amount: r.grossMinor - r.discountMinor, total: r.totalMinor };
  } catch {
    return null;
  }
}

export const ItemCard = memo(function ItemCard({
  item,
  index,
  isFirst,
  isLast,
  currency,
  error,
  groups,
  dispatch,
}: {
  item: DraftItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  currency: string;
  error?: string;
  groups: Array<{ id: string; title: string }>;
  dispatch: Dispatch<EditorAction>;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [open, setOpen] = useState(item.discountType !== "NONE" || item.hideUnitPriceInPdf);
  const [catalogMsg, setCatalogMsg] = useState<string | null>(null);
  const update = (patch: Partial<DraftItem>) => dispatch({ type: "updateItem", id: item.id, patch });
  const n = index + 1;
  const result = amountOf(item);
  const idp = `it-${item.id}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card relative p-3 sm:p-4 ${isDragging ? "z-10 shadow-lg ring-2 ring-focus" : ""} ${error ? "ring-1 ring-danger" : ""}`}
      aria-label={`Concepto ${n}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="mt-7 flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted hover:bg-black/5 active:cursor-grabbing"
          aria-label={`Arrastrar para reordenar el concepto ${n}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={20} aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Field label={`Concepto ${n}: descripción`} htmlFor={`${idp}-desc`}>
            <Textarea
              id={`${idp}-desc`}
              value={item.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
              className="min-h-16 text-[17px]"
              placeholder="Describe el servicio o producto"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.4fr_1.2fr]">
            <Field label="Cantidad" htmlFor={`${idp}-qty`}>
              <Input id={`${idp}-qty`} inputMode="decimal" value={item.quantity} onChange={(e) => update({ quantity: e.target.value })} invalid={Boolean(error && /Cantidad/.test(error))} />
            </Field>
            <Field label="Unidad" htmlFor={`${idp}-unit`}>
              <Input id={`${idp}-unit`} list="units-list" value={item.unit ?? ""} onChange={(e) => update({ unit: e.target.value || null })} maxLength={40} />
            </Field>
            <Field label={`Precio unitario (${currency})`} htmlFor={`${idp}-price`}>
              <Input id={`${idp}-price`} inputMode="decimal" value={item.unitPrice} onChange={(e) => update({ unitPrice: e.target.value })} invalid={Boolean(error && /Precio/.test(error))} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Importe</span>
              <output className="flex min-h-11 items-center justify-end rounded-[var(--radius-sm)] bg-surface-muted px-3 font-semibold break-all" htmlFor={`${idp}-qty ${idp}-price`}>
                {result ? formatMoney(result.amount, currency) : "—"}
              </output>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="IVA" htmlFor={`${idp}-tax`}>
              <Select
                id={`${idp}-tax`}
                value={item.taxMode}
                onChange={(e) => {
                  const mode = e.target.value as DraftItem["taxMode"];
                  update({ taxMode: mode, taxRate: mode === "NONE" ? "0" : item.taxRate === "0" ? "16" : item.taxRate });
                }}
              >
                <option value="NONE">Sin IVA</option>
                <option value="EXCLUSIVE">Más IVA</option>
                <option value="INCLUSIVE">IVA incluido en el precio</option>
              </Select>
            </Field>
            {item.taxMode !== "NONE" ? (
              <Field label="Tasa de IVA (%)" htmlFor={`${idp}-rate`}>
                <Input id={`${idp}-rate`} inputMode="decimal" value={item.taxRate} onChange={(e) => update({ taxRate: e.target.value })} invalid={Boolean(error && /Tasa/.test(error))} />
              </Field>
            ) : null}
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <button type="button" className="flex min-h-11 w-fit items-center gap-1 text-sm text-link" aria-expanded={open} onClick={() => setOpen(!open)}>
            <ChevronDown size={16} className={open ? "rotate-180" : ""} aria-hidden /> Más opciones
          </button>
          {open ? (
            <div className="grid gap-3 rounded-[var(--radius-sm)] bg-surface-muted p-3 sm:grid-cols-2">
              <Field label="Descuento" htmlFor={`${idp}-dt`}>
                <Select id={`${idp}-dt`} value={item.discountType} onChange={(e) => update({ discountType: e.target.value as DraftItem["discountType"], discountValue: "0" })}>
                  <option value="NONE">Sin descuento</option>
                  <option value="PERCENT">Porcentaje (%)</option>
                  <option value="FIXED">Monto fijo ({currency})</option>
                </Select>
              </Field>
              {item.discountType !== "NONE" ? (
                <Field label={item.discountType === "PERCENT" ? "Descuento (%)" : `Descuento (${currency})`} htmlFor={`${idp}-dv`}>
                  <Input id={`${idp}-dv`} inputMode="decimal" value={item.discountValue} onChange={(e) => update({ discountValue: e.target.value })} invalid={Boolean(error && /[Dd]escuento/.test(error))} />
                </Field>
              ) : null}
              {groups.length ? (
                <Field label="Sección" htmlFor={`${idp}-grp`}>
                  <Select id={`${idp}-grp`} value={item.groupId ?? ""} onChange={(e) => update({ groupId: e.target.value || null })}>
                    <option value="">Sin sección</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <div className="sm:col-span-2">
                <Checkbox id={`${idp}-hide`} label="Ocultar precio unitario en el PDF" checked={item.hideUnitPriceInPdf} onChange={(e) => update({ hideUnitPriceInPdf: e.target.checked })} />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className="flex min-h-11 items-center gap-2 text-sm text-link"
                  onClick={async () => {
                    setCatalogMsg(null);
                    const [title, ...rest] = item.description.trim().split("\n");
                    if (!title) return setCatalogMsg("Escribe una descripción primero.");
                    const res = await saveLineToCatalogAction({
                      title: title.slice(0, 300),
                      description: rest.join("\n").trim() || null,
                      unit: item.unit,
                      suggestedPrice: item.unitPrice || "0",
                      currency: currency as "MXN" | "USD",
                      taxMode: item.taxMode,
                      taxRate: item.taxRate || "0",
                    });
                    setCatalogMsg(res.ok ? "Guardado en el catálogo." : res.message);
                  }}
                >
                  <BookmarkPlus size={16} aria-hidden /> Guardar este concepto en catálogo
                </button>
                {catalogMsg ? (
                  <p className="text-sm text-muted" role="status">
                    {catalogMsg}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-1 border-t border-border pt-2">
        <button type="button" className={buttonClass("ghost", "sm")} disabled={isFirst} aria-label={`Subir concepto ${n}`} onClick={() => dispatch({ type: "moveItem", id: item.id, direction: -1 })}>
          <ArrowUp size={18} aria-hidden />
        </button>
        <button type="button" className={buttonClass("ghost", "sm")} disabled={isLast} aria-label={`Bajar concepto ${n}`} onClick={() => dispatch({ type: "moveItem", id: item.id, direction: 1 })}>
          <ArrowDown size={18} aria-hidden />
        </button>
        <button type="button" className={buttonClass("ghost", "sm")} aria-label={`Duplicar concepto ${n}`} onClick={() => dispatch({ type: "duplicateItem", id: item.id, newId: crypto.randomUUID() })}>
          <Copy size={18} aria-hidden /> <span className="hidden sm:inline">Duplicar</span>
        </button>
        <ConfirmDialog
          title={`¿Eliminar el concepto ${n}?`}
          description={item.description ? <span className="break-anywhere line-clamp-3">{item.description}</span> : "Este concepto está vacío."}
          confirmLabel="Eliminar"
          onConfirm={() => dispatch({ type: "removeItem", id: item.id })}
          trigger={(openDialog) => (
            <button type="button" className={`${buttonClass("ghost", "sm")} text-danger`} aria-label={`Eliminar concepto ${n}`} onClick={openDialog}>
              <Trash2 size={18} aria-hidden /> <span className="hidden sm:inline">Eliminar</span>
            </button>
          )}
        />
      </div>
      {index === 0 ? (
        <datalist id="units-list">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      ) : null}
    </li>
  );
});
