/**
 * Prepara una base de datos de PRUEBAS limpia (cotizador_test): reinicia el esquema,
 * aplica migraciones y configura el rol sin privilegios. Nunca toca la base de desarrollo.
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { Pool } from "pg";
import { testUrls } from "./urls";

export default async function setup() {
  const { admin, app } = testUrls();
  const pool = new Pool({ connectionString: admin, max: 1 });
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await pool.end();
  const env = { ...process.env, DATABASE_ADMIN_URL: admin, DATABASE_URL: app };
  execSync("npx tsx scripts/db-migrate.ts", { stdio: "inherit", env });
  execSync("npx tsx scripts/db-setup-roles.ts", { stdio: "inherit", env });
}
