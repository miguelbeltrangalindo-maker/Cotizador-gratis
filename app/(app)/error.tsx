"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const forbidden = /permiso/i.test(error.message);
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">{forbidden ? "Acceso denegado" : "Algo salió mal"}</h1>
      <p className="text-muted">{forbidden ? "Tu rol no permite realizar esta acción." : "No pudimos cargar esta pantalla. Inténtalo de nuevo."}</p>
      {error.digest ? <p className="text-xs text-muted">Código: {error.digest}</p> : null}
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
