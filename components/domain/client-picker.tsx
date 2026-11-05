"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { findSimilarClientsAction, quickCreateClientAction, searchClientsAction } from "@/features/clients/actions";
import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";

export interface ClientOption {
  id: string;
  name: string;
  businessName: string | null;
  taxId: string | null;
  email: string | null;
  preferredCurrency: string | null;
}

/** Selector de cliente con búsqueda en servidor y alta rápida en un diálogo. */
export function ClientPicker({
  value,
  onChange,
  label = "Cliente",
  disabled,
}: {
  value: ClientOption | null;
  onChange: (c: ClientOption | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  function search(term: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      setLoading(true);
      try {
        const r = await searchClientsAction(term);
        if (id === reqId.current) setResults(r);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-start justify-between gap-2 rounded-[var(--radius-sm)] border border-border-strong bg-surface-muted p-3">
          <div className="min-w-0">
            <p className="break-anywhere font-medium">{value.name}</p>
            <p className="break-anywhere text-sm text-muted">{[value.businessName, value.taxId, value.email].filter(Boolean).join(" · ")}</p>
          </div>
          {!disabled ? (
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => onChange(null)} aria-label="Cambiar cliente">
              <X size={18} aria-hidden /> Cambiar
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="client-search" className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="client-search"
          className="control pl-10"
          placeholder="Buscar por nombre, RFC o correo…"
          value={q}
          autoComplete="off"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls="client-results"
          onFocus={() => {
            setOpen(true);
            search(q);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            search(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>
      {open ? (
        <div id="client-results" className="card max-h-72 overflow-auto p-1" role="listbox" aria-label="Clientes">
          {loading && results.length === 0 ? <p className="p-3 text-sm text-muted">Buscando…</p> : null}
          {!loading && results.length === 0 ? <p className="p-3 text-sm text-muted">Sin coincidencias.</p> : null}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={false}
              className="flex min-h-11 w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-surface-muted"
              onClick={() => {
                onChange(c);
                setOpen(false);
                setQ("");
              }}
            >
              <span className="break-anywhere font-medium">{c.name}</span>
              <span className="break-anywhere text-sm text-muted">{[c.businessName, c.taxId, c.email].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-medium text-link hover:bg-surface-muted"
            onClick={() => setCreating(true)}
          >
            <UserPlus size={18} aria-hidden /> Crear cliente nuevo{q ? ` “${q}”` : ""}
          </button>
        </div>
      ) : null}
      {creating ? (
        <QuickClientDialog
          initialName={q}
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            onChange(c);
            setOpen(false);
            setQ("");
          }}
        />
      ) : null}
    </div>
  );
}

function QuickClientDialog({
  initialName,
  onCreated,
  onClose,
}: {
  initialName: string;
  onCreated: (c: ClientOption) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState({ name: initialName, businessName: "", taxId: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [similar, setSimilar] = useState<Array<{ id: string; name: string; taxId: string | null; email: string | null }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function checkSimilar() {
    if (!form.name.trim()) return setSimilar([]);
    setSimilar(await findSimilarClientsAction({ name: form.name, taxId: form.taxId, email: form.email }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await quickCreateClientAction(form);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setFieldErrors(res.fieldErrors ?? {});
      return;
    }
    onCreated(res.data);
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[min(94vw,480px)] rounded-[var(--radius-lg)] border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/40"
      aria-labelledby="quick-client-title"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 id="quick-client-title" className="text-lg font-semibold">
          Nuevo cliente
        </h2>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label="Nombre visible" htmlFor="qc-name" required error={fieldErrors.name}>
          <Input id="qc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={checkSimilar} maxLength={200} />
        </Field>
        {similar.length ? (
          <Alert tone="warning" title="Posibles duplicados">
            <ul className="list-disc pl-5">
              {similar.map((s) => (
                <li key={s.id}>
                  {s.name} {s.taxId ? `· ${s.taxId}` : ""} {s.email ? `· ${s.email}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1">Puedes continuar si realmente es un cliente distinto.</p>
          </Alert>
        ) : null}
        <Field label="Razón social" htmlFor="qc-business">
          <Input id="qc-business" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="RFC" htmlFor="qc-rfc" error={fieldErrors.taxId}>
            <Input id="qc-rfc" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value.toUpperCase() })} onBlur={checkSimilar} maxLength={13} />
          </Field>
          <Field label="Teléfono" htmlFor="qc-phone">
            <Input id="qc-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Correo" htmlFor="qc-email" error={fieldErrors.email}>
          <Input id="qc-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={checkSimilar} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClass("secondary")} onClick={() => dialogRef.current?.close()}>
            Cancelar
          </button>
          <button type="submit" className={buttonClass("primary")} disabled={busy}>
            {busy ? "Guardando…" : "Guardar cliente"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
