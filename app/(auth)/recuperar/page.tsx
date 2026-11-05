import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Recuperar contraseña" };
export const dynamic = "force-dynamic";

export default function RecoverPage() {
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  return (
    <div className="card p-5 sm:p-6">
      <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
      <div className="mt-4 flex flex-col gap-3">
        {smtpConfigured ? (
          <Alert tone="info">
            El envío de correos de restablecimiento está preparado pero aún no habilitado en esta versión. Contacta a la
            persona administradora de la plataforma.
          </Alert>
        ) : (
          <Alert tone="warning" title="El correo no está configurado en este servidor">
            No enviamos correos de restablecimiento sin un proveedor de correo configurado. La persona administradora del
            servidor puede asignarte una contraseña temporal con el comando local{" "}
            <code className="rounded bg-black/5 px-1">npm run user:reset-password</code>.
          </Alert>
        )}
        <Link href="/iniciar-sesion" className="text-link hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
