import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppMark } from "@/components/domain/app-mark";
import { ButtonLink } from "@/components/ui/button";

export default async function WelcomePage() {
  if (await getSession()) redirect("/inicio");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-8" style={{ paddingTop: "calc(var(--safe-top) + 32px)" }}>
      <AppMark />
      <section className="my-auto flex flex-col gap-6 py-12">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Crea una cotización profesional en minutos.
        </h1>
        <p className="text-lg text-muted">
          Sin Excel ni Word. Con tu logo y colores, cálculos exactos de IVA, PDF listo para enviar y control sencillo de
          recibos y saldos.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/registro" size="lg" className="sm:min-w-44">
            Crear cuenta
          </ButtonLink>
          <ButtonLink href="/iniciar-sesion" variant="secondary" size="lg" className="sm:min-w-44">
            Iniciar sesión
          </ButtonLink>
        </div>
        <ul className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-3">
          <li className="card p-4">Varias marcas por empresa, cada una con su identidad.</li>
          <li className="card p-4">Montos siempre con moneda: MXN o USD, sin ambigüedad.</li>
          <li className="card p-4">Recibos de anticipo y saldo pendiente al instante.</li>
        </ul>
      </section>
      <footer className="text-center text-xs text-muted">
        Los recibos son comprobantes comerciales y no sustituyen un CFDI. <Link href="/iniciar-sesion" className="underline">Acceder</Link>
      </footer>
    </main>
  );
}
