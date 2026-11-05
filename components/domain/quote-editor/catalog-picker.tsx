"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { searchCatalogAction } from "@/features/catalog/actions";
import { formatUnitPrice } from "@/lib/money";
import { buttonClass } from "@/components/ui/button";

export interface CatalogOption {
  id: string;
  title: string;
  description: string | null;
  unit: string | null;
  suggestedPrice: string;
  currency: string;
  taxMode: string;
  taxRate: string;
}

export function CatalogPicker({ onPick, trigger }: { onPick: (c: CatalogOption) => void; trigger: (open: () => void) => ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CatalogOption[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(term: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => setRows(await searchCatalogAction(term)), 250);
  }

  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  return (
    <>
      {trigger(() => {
        setIsOpen(true);
        void searchCatalogAction(q).then(setRows);
      })}
      <dialog ref={ref} onClose={() => setIsOpen(false)} className="m-auto w-[min(94vw,560px)] rounded-[var(--radius-lg)] border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/40" aria-labelledby="catalog-title">
        <div className="flex max-h-[80dvh] flex-col gap-3 p-5">
          <h2 id="catalog-title" className="text-lg font-semibold">
            Agregar desde catálogo
          </h2>
          <label htmlFor="catalog-q" className="sr-only">
            Buscar en catálogo
          </label>
          <input
            id="catalog-q"
            className="control"
            placeholder="Buscar concepto…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              search(e.target.value);
            }}
          />
          <ul className="flex flex-col gap-1 overflow-auto">
            {rows === null ? <li className="p-3 text-muted">Cargando…</li> : null}
            {rows?.length === 0 ? (
              <li className="p-3 text-muted">
                Sin conceptos. Puedes crearlos en <Link className="text-link underline" href="/catalogo">Servicios y productos</Link> o con “Guardar este concepto en catálogo”.
              </li>
            ) : null}
            {rows?.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-surface-muted"
                  onClick={() => {
                    onPick(r);
                    setIsOpen(false);
                  }}
                >
                  <span className="break-anywhere font-medium">{r.title}</span>
                  <span className="text-sm text-muted">
                    {formatUnitPrice(r.suggestedPrice, r.currency)}
                    {r.unit ? ` / ${r.unit}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button type="button" className={buttonClass("secondary")} onClick={() => setIsOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
