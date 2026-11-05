import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/inicio");
  return (
    <div className="card p-5 sm:p-6">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <p className="mt-1 text-muted">Empieza a cotizar en minutos. Es gratis.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/iniciar-sesion" className="font-medium text-link hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
