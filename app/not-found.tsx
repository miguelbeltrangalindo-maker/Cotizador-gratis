import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">No encontrado</h1>
      <p className="text-muted">El recurso no existe o no tienes acceso a él.</p>
      <Link href="/inicio" className="min-h-11 content-center text-link underline">
        Volver al inicio
      </Link>
    </main>
  );
}
