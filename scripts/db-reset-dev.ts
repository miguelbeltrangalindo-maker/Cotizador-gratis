/** Reinicio controlado de la base local. JAMÁS disponible en producción. */
import "dotenv/config";
import { Pool } from "pg";
import { execSync } from "node:child_process";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("db:reset:dev está prohibido en producción.");
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) throw new Error("DATABASE_ADMIN_URL no está definida");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "postgres", "db"].includes(host) && process.env.ALLOW_REMOTE_RESET !== "true") {
    throw new Error(`Por seguridad solo se reinician bases locales (host actual: ${host}).`);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await pool.end();
  console.log("✔ Esquema reiniciado. Aplicando migraciones…");
  execSync("npx tsx scripts/db-migrate.ts", { stdio: "inherit" });
  execSync("npx tsx scripts/db-setup-roles.ts", { stdio: "inherit" });
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
