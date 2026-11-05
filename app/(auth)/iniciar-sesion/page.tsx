import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Alert } from "@/components/ui/misc";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expirada?: string; next?: string }> }) {
  if (await getSession()) redirect("/inicio");
  const sp = await searchParams;
  return (
    <div className="card p-5 sm:p-6">
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      {sp.expirada ? (
        <div className="mt-4">
          <Alert tone="info">Tu sesión expiró o no has iniciado sesión. Ingresa de nuevo para continuar.</Alert>
        </div>
      ) : null}
      <LoginForm next={sp.next ?? ""} />
      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted">
        <Link href="/recuperar" className="text-link hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <p>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-link hover:underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
