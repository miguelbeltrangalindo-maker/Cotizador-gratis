import type { Metadata } from "next";
import { AppMark } from "@/components/domain/app-mark";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <AppMark />
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="text-muted">
        No hay conexión a internet. Tus cotizaciones y recibos se guardan en el servidor, así que necesitas red para verlos o
        modificarlos. Si tenías cambios sin guardar en otra pestaña, siguen ahí mientras no la cierres.
      </p>
      <a href="/inicio" className="min-h-11 content-center rounded-[var(--radius-sm)] bg-primary px-5 font-medium text-white">
        Reintentar
      </a>
    </main>
  );
}
