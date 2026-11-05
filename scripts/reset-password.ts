/**
 * Restablecimiento local de contraseña (alternativa segura cuando no hay SMTP).
 * Uso: npm run user:reset-password -- correo@ejemplo.com [nueva-contraseña]
 * Si no se indica contraseña, genera una temporal aleatoria. Cierra todas las sesiones del usuario.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { closeDb } from "@/lib/db";
import { adminResetPassword } from "@/features/auth/service";

async function main() {
  const [email, pwd] = process.argv.slice(2);
  if (!email) throw new Error("Uso: npm run user:reset-password -- correo@ejemplo.com [nueva-contraseña]");
  const password = pwd ?? `Tmp-${randomBytes(9).toString("base64url")}1a`;
  await adminResetPassword(email, password);
  console.log(`✔ Contraseña restablecida para ${email}.`);
  if (!pwd) console.log(`  Contraseña temporal: ${password}  (pídele cambiarla en Ajustes → Mi perfil)`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
