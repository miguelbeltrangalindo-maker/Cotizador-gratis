/**
 * Configura el rol de ejecución `cotizador_app` con LOGIN y la contraseña
 * indicada en DATABASE_URL. Requiere DATABASE_ADMIN_URL con permisos CREATEROLE.
 * Es idempotente y nunca concede BYPASSRLS.
 */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const admin = process.env.DATABASE_ADMIN_URL;
  const app = process.env.DATABASE_URL;
  if (!admin || !app) throw new Error("Define DATABASE_ADMIN_URL y DATABASE_URL");
  const appUrl = new URL(app);
  const role = decodeURIComponent(appUrl.username);
  const password = decodeURIComponent(appUrl.password);
  if (role !== "cotizador_app") {
    throw new Error("DATABASE_URL debe usar el usuario cotizador_app (las políticas RLS se definen para ese rol)");
  }
  if (!password) throw new Error("DATABASE_URL debe incluir contraseña para cotizador_app");
  const pool = new Pool({ connectionString: admin, max: 1 });
  const client = await pool.connect();
  try {
    const exists = await client.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      "select rolsuper, rolbypassrls from pg_roles where rolname = $1",
      [role],
    );
    const lit = password.replace(/'/g, "''");
    if (exists.rowCount === 0) {
      await client.query(`CREATE ROLE cotizador_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${lit}'`);
    } else {
      // En servicios gestionados (p. ej. Neon) el administrador no puede modificar SUPERUSER/BYPASSRLS
      // de un rol existente: solo se actualiza LOGIN y contraseña, y se VERIFICA que no tenga privilegios
      // que anulen RLS (si los tuviera, se aborta en lugar de continuar).
      const { rolsuper, rolbypassrls } = exists.rows[0];
      if (rolsuper || rolbypassrls) {
        throw new Error("El rol cotizador_app tiene SUPERUSER o BYPASSRLS; corrígelo manualmente antes de continuar");
      }
      await client.query(`ALTER ROLE cotizador_app LOGIN PASSWORD '${lit}'`);
    }
    const dbName = new URL(admin).pathname.slice(1);
    await client.query(`GRANT CONNECT ON DATABASE "${dbName.replace(/"/g, "")}" TO cotizador_app`);
    console.log("✔ Rol cotizador_app listo (LOGIN, NOBYPASSRLS)");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
