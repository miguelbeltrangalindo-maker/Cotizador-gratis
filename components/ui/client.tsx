"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./button";

export function SubmitButton({
  children,
  pendingText = "Guardando…",
  variant = "primary",
  className = "",
  disabled,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={buttonClass(variant, "md", className)}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Diálogo de confirmación accesible basado en <dialog> nativo (Escape, foco atrapado). */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  tone = "danger",
  onConfirm,
  children,
}: {
  trigger: (open: () => void) => ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  onConfirm?: () => void | Promise<void>;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);
  return (
    <>
      {trigger(() => setIsOpen(true))}
      <dialog
        ref={ref}
        onClose={() => setIsOpen(false)}
        className="m-auto w-[min(92vw,440px)] rounded-[var(--radius-lg)] border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/40"
        aria-labelledby="confirm-title"
      >
        <div className="flex flex-col gap-4 p-5">
          <h2 id="confirm-title" className="text-lg font-semibold">
            {title}
          </h2>
          {description ? <div className="text-muted">{description}</div> : null}
          {children}
          {onConfirm ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={buttonClass("secondary")} onClick={() => setIsOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                className={buttonClass(tone === "danger" ? "danger" : "primary")}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onConfirm();
                    setIsOpen(false);
                  } catch {
                    // El llamador muestra el error dentro del diálogo; se mantiene abierto.
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Procesando…" : confirmLabel}
              </button>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

/** Banner de conexión perdida. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 bg-warning-bg px-4 py-2 text-center text-sm font-medium text-warning" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
      Sin conexión. Tus cambios no confirmados se conservan en esta pestaña; no se pueden guardar hasta recuperar la red.
    </div>
  );
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
