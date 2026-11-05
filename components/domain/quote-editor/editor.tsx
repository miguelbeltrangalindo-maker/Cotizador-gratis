"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, BookOpen, Eye, FolderPlus, Plus, Trash2 } from "lucide-react";
import { changeQuoteStatusAction, saveDraftAction } from "@/features/quotes/actions";
import { editorReducer, orderedSections } from "@/features/quotes/editor-state";
import type { DraftData, DraftItem } from "@/features/quotes/schema";
import type { CustomFieldDefinitionSnapshot } from "@/features/custom-fields/service";
import { buildSections } from "@/features/documents/snapshot";
import { PAPER_SIZES, PDF_TEMPLATES, PDF_TEMPLATE_LABEL } from "@/features/brands/constants";
import {
  computeLine,
  formatMoney,
  formatPercent,
  MoneyError,
  RETENTION_PRESETS,
  retentionLabel,
  retentionPresetOf,
  type RetentionPreset,
} from "@/lib/money";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/client";
import { ClientPicker, type ClientOption } from "@/components/domain/client-picker";
import { ItemCard } from "./item-card";
import { CatalogPicker, type CatalogOption } from "./catalog-picker";

/** Estado de la última operación de guardado (lo "sucio" se deriva comparando con lo confirmado). */
type SaveOp = "idle" | "saving" | "error" | "conflict";
type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict" | "invalid";

export interface EditorBrand {
  id: string;
  name: string;
  defaultTaxMode: "NONE" | "EXCLUSIVE" | "INCLUSIVE";
  defaultTaxRate: string;
  pdfTemplate: string;
  paperSize: string;
}

const AUTOSAVE_MS = 900;

function uuid() {
  return crypto.randomUUID();
}

function trimRate(r: string) {
  return r.includes(".") ? r.replace(/\.?0+$/, "") : r;
}

export function QuoteEditor(props: {
  quoteId: string;
  versionId: string;
  initialRevision: number;
  initialDraft: DraftData;
  folio: string | null;
  versionNumber: number;
  brands: EditorBrand[];
  customDefs: CustomFieldDefinitionSnapshot[];
  initialClient: ClientOption | null;
  hasReceipts: boolean;
}) {
  const router = useRouter();
  const [draft, dispatch] = useReducer(editorReducer, props.initialDraft);
  const [client, setClient] = useState<ClientOption | null>(props.initialClient);
  const [saveOp, setSaveOp] = useState<SaveOp>("idle");
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(props.initialDraft));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [currencyWarning, setCurrencyWarning] = useState(false);

  const revision = useRef(props.initialRevision);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const pendingAgain = useRef(false);
  const latest = useRef(draft);
  const lastSavedJson = useRef(savedJson);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftJson = useMemo(() => JSON.stringify(draft), [draft]);

  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const brand = props.brands.find((b) => b.id === draft.brandId) ?? props.brands[0];

  // Validación local por línea (el servidor vuelve a validar y recalcular).
  const itemErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const it of draft.items) {
      try {
        computeLine(it);
      } catch (e) {
        errs[it.id] = e instanceof MoneyError ? e.message : "Valor inválido";
      }
    }
    return errs;
  }, [draft.items]);
  const hasErrors = Object.keys(itemErrors).length > 0;

  const isDirty = draftJson !== savedJson;
  const saveState: SaveState =
    saveOp === "conflict"
      ? "conflict"
      : saveOp === "saving"
        ? "saving"
        : saveOp === "error"
          ? "error"
          : isDirty
            ? hasErrors
              ? "invalid"
              : "dirty"
            : "saved";

  const computed = useMemo(() => {
    if (hasErrors) return null;
    try {
      return buildSections(
        draft.groups,
        draft.items.map((i) => ({ ...i, unit: i.unit ?? null })),
        { ivaRate: draft.retentionIvaRate, isrRate: draft.retentionIsrRate },
      );
    } catch (e) {
      if (e instanceof MoneyError) return null;
      throw e;
    }
  }, [draft.groups, draft.items, draft.retentionIvaRate, draft.retentionIsrRate, hasErrors]);
  const retentionPreset = retentionPresetOf(draft.retentionIvaRate || 0, draft.retentionIsrRate || 0);

  const saveOnce = useCallback(async (): Promise<boolean> => {
    const snapshot = latest.current;
    const json = JSON.stringify(snapshot);
    if (json === lastSavedJson.current) return true;
    setSaveOp("saving");
    setSaveError(null);
    const p = (async () => {
      try {
        const res = await saveDraftAction(props.quoteId, props.versionId, revision.current, snapshot);
        if (!res.ok) {
          setSaveOp(res.code === "CONFLICT" ? "conflict" : "error");
          setSaveError(res.message);
          return false;
        }
        revision.current = res.data.revision;
        lastSavedJson.current = json;
        setSavedJson(json);
        setSaveOp("idle");
        return true;
      } catch {
        setSaveOp("error");
        setSaveError(navigator.onLine ? "No se pudo guardar. Reintenta." : "Sin conexión: tus cambios siguen en esta pestaña.");
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = p;
    return p;
  }, [props.quoteId, props.versionId]);

  /** Guarda sin solicitudes simultáneas: si ya hay una en curso, encola otra al terminar. */
  const doSave = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) {
      pendingAgain.current = true;
      return inFlight.current;
    }
    let ok = await saveOnce();
    while (ok && pendingAgain.current) {
      pendingAgain.current = false;
      ok = await saveOnce();
    }
    return ok;
  }, [saveOnce]);

  // Autoguardado con debounce; no guarda si hay errores locales ni durante un conflicto.
  useEffect(() => {
    if (draftJson === lastSavedJson.current || saveOp === "conflict" || hasErrors) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draftJson, hasErrors, saveOp, doSave]);

  // Advierte al salir con cambios sin confirmar por el servidor.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== lastSavedJson.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const set = useCallback((patch: Partial<DraftData>) => dispatch({ type: "set", patch }), []);

  const newItem = useCallback(
    (groupId: string | null, from?: Partial<DraftItem>): DraftItem => ({
      id: uuid(),
      groupId,
      description: "",
      unit: null,
      quantity: "1",
      unitPrice: "0",
      discountType: "NONE",
      discountValue: "0",
      taxMode: brand?.defaultTaxMode ?? "NONE",
      taxRate: brand?.defaultTaxMode === "NONE" ? "0" : trimRate(brand?.defaultTaxRate ?? "16"),
      hideUnitPriceInPdf: false,
      ...from,
    }),
    [brand],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) {
      dispatch({ type: "reorderItem", activeId: String(e.active.id), overId: String(e.over.id) });
    }
  }

  function addFromCatalog(c: CatalogOption, groupId: string | null) {
    if (c.currency !== draft.currency) {
      setIssueError(
        `El concepto “${c.title}” tiene precio en ${c.currency} y la cotización está en ${draft.currency}. Se agregó el número sin convertir: revisa el precio.`,
      );
    }
    dispatch({
      type: "addItem",
      item: newItem(groupId, {
        description: c.description ? `${c.title}\n${c.description}` : c.title,
        unit: c.unit,
        unitPrice: c.suggestedPrice.replace(/\.?0+$/, "") || "0",
        taxMode: c.taxMode as DraftItem["taxMode"],
        taxRate: c.taxMode === "NONE" ? "0" : trimRate(c.taxRate),
      }),
    });
  }

  async function markSent() {
    setIssueError(null);
    const problems: string[] = [];
    if (!draft.clientId) problems.push("Selecciona un cliente.");
    if (draft.items.length === 0) problems.push("Agrega al menos un concepto.");
    draft.items.forEach((it, i) => {
      if (!it.description.trim()) problems.push(`El concepto ${i + 1} no tiene descripción.`);
    });
    for (const d of props.customDefs) {
      const v = draft.customValues[d.fieldKey];
      if (d.required && (v === undefined || v === null || v === "")) problems.push(`Completa “${d.label}”.`);
    }
    if (hasErrors) problems.push("Corrige los conceptos marcados en rojo.");
    if (problems.length) {
      setIssueError(problems.join(" "));
      return;
    }
    setIssuing(true);
    const saved = await doSave();
    if (!saved) {
      setIssuing(false);
      setIssueError("Primero hay que guardar los cambios. Revisa el estado de guardado.");
      return;
    }
    const res = await changeQuoteStatusAction(props.quoteId, "SENT");
    setIssuing(false);
    if (!res.ok) {
      setIssueError(res.message);
      return;
    }
    router.push(`/cotizaciones/${props.quoteId}?enviada=1`);
    router.refresh();
  }

  const sections = orderedSections(draft);
  const groupOptions = draft.groups.map((g) => ({ id: g.id, title: g.title || "Sección sin título" }));
  const statusText: Record<SaveState, string> = {
    dirty: "Cambios sin guardar…",
    saving: "Guardando…",
    saved: "Guardado automáticamente",
    error: "Error al guardar",
    conflict: "Conflicto de edición",
    invalid: "Hay datos por corregir",
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted">
          {props.folio ? `${props.folio} · ` : ""}Versión {props.versionNumber} · Borrador
        </p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{props.folio ? "Editar cotización" : "Nueva cotización"}</h1>
      </header>

      {saveState === "conflict" ? (
        <Alert tone="danger" title="Otra pestaña o persona modificó esta cotización">
          <p>{saveError}</p>
          <button type="button" className="mt-2 font-semibold underline" onClick={() => window.location.reload()}>
            Recargar la versión más reciente
          </button>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* A. Cliente y marca */}
          <section className="card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="sec-a">
            <h2 id="sec-a" className="text-lg font-semibold">
              Cliente y marca
            </h2>
            <ClientPicker
              value={client}
              onChange={(c) => {
                setClient(c);
                set({ clientId: c?.id ?? null });
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Marca emisora" htmlFor="brand" hint={props.folio ? "No se puede cambiar después de asignar folio." : undefined}>
                <Select id="brand" value={draft.brandId} disabled={Boolean(props.folio)} onChange={(e) => set({ brandId: e.target.value })}>
                  {props.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Moneda"
                htmlFor="currency"
                hint={props.hasReceipts ? "Bloqueada: ya hay recibos vinculados." : "Cambiar la moneda no convierte importes."}
              >
                <Select
                  id="currency"
                  value={draft.currency}
                  disabled={props.hasReceipts}
                  onChange={(e) => {
                    set({ currency: e.target.value as DraftData["currency"] });
                    if (draft.items.some((i) => Number(i.unitPrice) > 0)) setCurrencyWarning(true);
                  }}
                >
                  <option value="MXN">MXN — Peso mexicano</option>
                  <option value="USD">USD — Dólar estadounidense</option>
                </Select>
              </Field>
            </div>
            {currencyWarning ? (
              <Alert tone="warning" title="Revisa los precios">
                Cambiaste la moneda a {draft.currency}. Los importes NO se convirtieron automáticamente; ajústalos manualmente.
              </Alert>
            ) : null}
          </section>

          {/* B. Datos generales */}
          <section className="card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="sec-b">
            <h2 id="sec-b" className="text-lg font-semibold">
              Datos generales
            </h2>
            <Field label="Título del proyecto o servicio" htmlFor="title">
              <Input id="title" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={500} />
            </Field>
            <Field label="Descripción general" htmlFor="desc">
              <Textarea id="desc" value={draft.serviceDescription} onChange={(e) => set({ serviceDescription: e.target.value })} rows={3} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha de emisión" htmlFor="issueDate">
                <Input id="issueDate" type="date" value={draft.issueDate ?? ""} onChange={(e) => set({ issueDate: e.target.value || null })} />
              </Field>
              <Field label="Vigente hasta" htmlFor="validUntil">
                <Input id="validUntil" type="date" value={draft.validUntil ?? ""} onChange={(e) => set({ validUntil: e.target.value || null })} />
              </Field>
              <Field label="Ubicación" htmlFor="location">
                <Input id="location" value={draft.location} onChange={(e) => set({ location: e.target.value })} />
              </Field>
              <Field label="Duración estimada" htmlFor="duration">
                <Input id="duration" value={draft.duration} onChange={(e) => set({ duration: e.target.value })} />
              </Field>
              <Field label="Persona responsable" htmlFor="responsible">
                <Input id="responsible" value={draft.responsible} onChange={(e) => set({ responsible: e.target.value })} />
              </Field>
            </div>
            {props.customDefs.length ? (
              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                {props.customDefs.map((d) => (
                  <CustomFieldInput
                    key={d.fieldKey}
                    def={d}
                    value={draft.customValues[d.fieldKey] ?? null}
                    onChange={(v) => dispatch({ type: "setCustom", key: d.fieldKey, value: v })}
                  />
                ))}
              </div>
            ) : null}
          </section>

          {/* C. Conceptos */}
          <section className="flex flex-col gap-3" aria-labelledby="sec-c">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="sec-c" className="text-lg font-semibold">
                Conceptos <span className="font-normal text-muted">({draft.items.length})</span>
              </h2>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sections.flatMap((s) => s.items.map((i) => i.id))} strategy={verticalListSortingStrategy}>
                {sections.map((s, sIdx) => (
                  <div key={s.group?.id ?? "root"} className={s.group ? "rounded-[var(--radius)] border border-dashed border-border-strong p-2 sm:p-3" : ""}>
                    {s.group ? (
                      <div className="mb-3 flex flex-wrap items-end gap-2">
                        <Field label="Título de la sección" htmlFor={`g-${s.group.id}`} className="min-w-0 flex-1">
                          <Input
                            id={`g-${s.group.id}`}
                            value={s.group.title}
                            onChange={(e) => dispatch({ type: "updateGroup", id: s.group!.id, patch: { title: e.target.value } })}
                            maxLength={200}
                          />
                        </Field>
                        <div className="flex gap-1">
                          <button type="button" className={buttonClass("ghost", "sm")} aria-label="Subir sección" disabled={sIdx <= 1} onClick={() => dispatch({ type: "moveGroup", id: s.group!.id, direction: -1 })}>
                            <ArrowUp size={18} aria-hidden />
                          </button>
                          <button type="button" className={buttonClass("ghost", "sm")} aria-label="Bajar sección" disabled={sIdx === sections.length - 1} onClick={() => dispatch({ type: "moveGroup", id: s.group!.id, direction: 1 })}>
                            <ArrowDown size={18} aria-hidden />
                          </button>
                          <ConfirmDialog
                            title="¿Quitar la sección?"
                            description="Los conceptos de esta sección se conservan y pasan a la lista general."
                            confirmLabel="Quitar sección"
                            onConfirm={() => dispatch({ type: "removeGroup", id: s.group!.id })}
                            trigger={(open) => (
                              <button type="button" className={buttonClass("ghost", "sm")} aria-label="Quitar sección" onClick={open}>
                                <Trash2 size={18} aria-hidden />
                              </button>
                            )}
                          />
                        </div>
                        <Checkbox
                          id={`gs-${s.group.id}`}
                          label="Mostrar subtotal de sección"
                          checked={s.group.showSubtotal}
                          onChange={(e) => dispatch({ type: "updateGroup", id: s.group!.id, patch: { showSubtotal: e.target.checked } })}
                        />
                      </div>
                    ) : null}
                    <ul className="flex flex-col gap-3">
                      {s.items.map((it, idx) => (
                        <ItemCard
                          key={it.id}
                          item={it}
                          index={draft.items.findIndex((x) => x.id === it.id)}
                          isFirst={idx === 0}
                          isLast={idx === s.items.length - 1}
                          currency={draft.currency}
                          error={itemErrors[it.id]}
                          groups={groupOptions}
                          dispatch={dispatch}
                        />
                      ))}
                    </ul>
                    {s.group ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "addItem", item: newItem(s.group!.id) })}>
                          <Plus size={18} aria-hidden /> Concepto en esta sección
                        </Button>
                        {computed ? (
                          <span className="text-sm text-muted">
                            Subtotal sección:{" "}
                            <strong className="text-text">
                              {formatMoney(sectionAmount(s.items), draft.currency)}
                            </strong>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </SortableContext>
            </DndContext>
            {draft.items.length === 0 ? (
              <div className="card p-6 text-center text-muted">Agrega tu primer concepto: descripción, cantidad y precio.</div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => dispatch({ type: "addItem", item: newItem(null) })}>
                <Plus size={18} aria-hidden /> Agregar concepto
              </Button>
              <CatalogPicker
                onPick={(c) => addFromCatalog(c, null)}
                trigger={(open) => (
                  <Button variant="secondary" onClick={open}>
                    <BookOpen size={18} aria-hidden /> Desde catálogo
                  </Button>
                )}
              />
              <Button variant="secondary" onClick={() => dispatch({ type: "addGroup", group: { id: uuid(), title: "Nueva sección", showSubtotal: true } })}>
                <FolderPlus size={18} aria-hidden /> Agregar sección
              </Button>
            </div>
          </section>

          {/* E. Condiciones */}
          <section className="card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="sec-e">
            <h2 id="sec-e" className="text-lg font-semibold">
              Condiciones y notas
            </h2>
            <Field label="Condiciones de pago" htmlFor="paymentTerms">
              <Textarea id="paymentTerms" value={draft.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} rows={3} />
            </Field>
            <Field label="Vigencia (texto)" htmlFor="validityTerms" hint="Ej.: Precios válidos por 15 días naturales.">
              <Textarea id="validityTerms" value={draft.validityTerms} onChange={(e) => set({ validityTerms: e.target.value })} rows={2} />
            </Field>
            <Field label="Notas para el cliente" htmlFor="publicNotes">
              <Textarea id="publicNotes" value={draft.publicNotes} onChange={(e) => set({ publicNotes: e.target.value })} rows={3} />
            </Field>
            <Field label="Notas internas" htmlFor="internalNotes" hint="No se imprimen ni aparecen en el PDF.">
              <Textarea id="internalNotes" value={draft.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} rows={2} className="bg-warning-bg/40" />
            </Field>
          </section>
        </div>

        {/* D/F. Resumen y exportar */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <section className="card flex flex-col gap-3 p-4 sm:p-5" aria-labelledby="sec-d">
            <h2 id="sec-d" className="text-lg font-semibold">
              Resumen
            </h2>
            {computed ? (
              <dl className="flex flex-col gap-2 text-sm">
                {computed.totals.discountMinor > 0 ? (
                  <>
                    <Row label="Importe bruto" value={formatMoney(computed.totals.grossMinor, draft.currency)} />
                    <Row label="Descuentos" value={`-${formatMoney(computed.totals.discountMinor, draft.currency)}`} />
                  </>
                ) : null}
                <Row label="Subtotal" value={formatMoney(computed.totals.subtotalMinor, draft.currency)} />
                {computed.totals.taxBreakdown.map((t) => (
                  <Row key={`${t.mode}${t.rate}`} label={`IVA ${formatPercent(t.rate)}${t.mode === "INCLUSIVE" ? " (incluido)" : ""}`} value={formatMoney(t.taxMinor, draft.currency)} />
                ))}
                {computed.totals.retentions?.length ? (
                  <>
                    <Row label="Total antes de retenciones" value={formatMoney(computed.totals.totalBeforeRetentionsMinor ?? computed.totals.totalMinor, draft.currency)} />
                    {computed.totals.retentions.map((r) => (
                      <Row key={r.kind} label={retentionLabel(r)} value={`-${formatMoney(r.amountMinor, draft.currency)}`} />
                    ))}
                  </>
                ) : null}
                <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-border pt-3">
                  <dt className="font-semibold">{computed.totals.retentions?.length ? "Total a pagar" : "Total"}</dt>
                  <dd className="text-right text-xl font-semibold">{formatMoney(computed.totals.totalMinor, draft.currency)}</dd>
                </div>
              </dl>
            ) : (
              <Alert tone="warning">Corrige los conceptos marcados para ver el total.</Alert>
            )}
            <Field label="Retenciones" htmlFor="retentions" hint="Aplican cuando el cliente es persona moral. No es asesoría fiscal.">
              <Select
                id="retentions"
                value={retentionPreset ?? "CUSTOM"}
                onChange={(e) => {
                  const p = RETENTION_PRESETS[e.target.value as RetentionPreset];
                  if (p) set({ retentionIvaRate: p.ivaRate, retentionIsrRate: p.isrRate });
                }}
              >
                {(Object.keys(RETENTION_PRESETS) as RetentionPreset[]).map((k) => (
                  <option key={k} value={k}>
                    {RETENTION_PRESETS[k].label}
                  </option>
                ))}
                {retentionPreset === null ? (
                  <option value="CUSTOM">
                    {`Personalizadas: IVA ${formatPercent(draft.retentionIvaRate || "0")}, ISR ${formatPercent(draft.retentionIsrRate || "0")}`}
                  </option>
                ) : null}
              </Select>
            </Field>
            <div className="flex flex-col border-t border-border pt-2">
              <Checkbox id="showUnitPrices" label="Mostrar precios unitarios en el PDF" checked={draft.showUnitPrices} onChange={(e) => set({ showUnitPrices: e.target.checked })} />
              <Checkbox id="showOnlyGrandTotal" label="Mostrar solo el total general" checked={draft.showOnlyGrandTotal} onChange={(e) => set({ showOnlyGrandTotal: e.target.checked })} />
            </div>
          </section>

          <section className="card flex flex-col gap-3 p-4 sm:p-5" aria-labelledby="sec-f">
            <h2 id="sec-f" className="text-lg font-semibold">
              Vista previa y envío
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estilo" htmlFor="tpl">
                <Select id="tpl" value={draft.pdfTemplate ?? brand?.pdfTemplate ?? "MINIMAL"} onChange={(e) => set({ pdfTemplate: e.target.value as DraftData["pdfTemplate"] })}>
                  {PDF_TEMPLATES.map((t) => (
                    <option key={t} value={t}>
                      {PDF_TEMPLATE_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Papel" htmlFor="paper">
                <Select id="paper" value={draft.paperSize ?? brand?.paperSize ?? "LETTER"} onChange={(e) => set({ paperSize: e.target.value as DraftData["paperSize"] })}>
                  {PAPER_SIZES.map((p) => (
                    <option key={p} value={p}>
                      {p === "LETTER" ? "Carta" : "A4"}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                const w = window.open("about:blank", "_blank");
                const ok = await doSave();
                if (ok && w) w.location.href = `/cotizaciones/${props.quoteId}/vista-previa`;
                else w?.close();
              }}
            >
              <Eye size={18} aria-hidden /> Vista previa del PDF
            </Button>
            {issueError ? <Alert tone="danger">{issueError}</Alert> : null}
            <Button onClick={markSent} disabled={issuing || saveState === "conflict"}>
              {issuing ? "Emitiendo…" : "Emitir y asignar folio"}
            </Button>
            <p className="text-xs text-muted">Los cambios se guardan solos como borrador (sin folio). Al emitirla se asigna el folio, queda marcada como enviada y esta versión ya no se edita; para cambios posteriores se crea una nueva versión con el mismo folio.</p>
          </section>
        </aside>
      </div>

      {/* Barra de acciones fija (sobre la navegación inferior en móvil) */}
      <div className="sticky-actions">
        <div className="card flex items-center justify-between gap-3 px-4 py-2.5">
          <p className="min-w-0 text-sm" role="status" aria-live="polite">
            <span
              className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
                saveState === "saved"
                  ? "bg-success"
                  : saveState === "error" || saveState === "conflict" || saveState === "invalid"
                    ? "bg-danger"
                    : "bg-warning"
              }`}
              aria-hidden
            />
            {statusText[saveState]}
            {saveState === "error" && saveError ? <span className="block text-xs text-danger">{saveError}</span> : null}
          </p>
          <div className="flex shrink-0 gap-2">
            {saveState === "error" ? (
              <Button size="sm" variant="secondary" onClick={() => void doSave()}>
                Reintentar
              </Button>
            ) : null}
            <Button size="sm" onClick={() => void doSave()} disabled={saveState === "saving" || hasErrors || saveState === "conflict"}>
              Guardar
            </Button>
            <ButtonLink size="sm" variant="ghost" href={`/cotizaciones/${props.quoteId}`}>
              Salir
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Suma de la columna "Importe" (bruto − descuento) de una sección. */
function sectionAmount(items: DraftItem[]): number {
  return items.reduce((acc, i) => {
    const r = computeLine(i);
    return acc + r.grossMinor - r.discountMinor;
  }, 0);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium whitespace-nowrap">{value}</dd>
    </div>
  );
}

function CustomFieldInput({
  def,
  value,
  onChange,
}: {
  def: CustomFieldDefinitionSnapshot;
  value: string | number | boolean | null;
  onChange: (v: string | number | boolean | null) => void;
}) {
  const id = `cf-${def.fieldKey}`;
  const label = `${def.label}${def.visibleInPdf ? "" : " (no se imprime)"}`;
  switch (def.type) {
    case "long_text":
      return (
        <Field label={label} htmlFor={id} required={def.required} className="sm:col-span-2">
          <Textarea id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} maxLength={5000} />
        </Field>
      );
    case "number":
      return (
        <Field label={label} htmlFor={id} required={def.required}>
          <Input id={id} inputMode="decimal" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case "date":
      return (
        <Field label={label} htmlFor={id} required={def.required}>
          <Input id={id} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)} />
        </Field>
      );
    case "select":
      return (
        <Field label={label} htmlFor={id} required={def.required}>
          <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">—</option>
            {def.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "checkbox":
      return <Checkbox id={id} label={label} checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    default:
      return (
        <Field label={label} htmlFor={id} required={def.required}>
          <Input id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} maxLength={300} />
        </Field>
      );
  }
}
