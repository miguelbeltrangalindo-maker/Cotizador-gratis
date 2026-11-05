import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) throw new Error("DATABASE_ADMIN_URL no está definida");
  const pool = new Pool({ connectionString: url, max: 1 });
  await migrate(drizzle(pool), { migrationsFolder: "./lib/db/migrations" });
  await pool.end();
  console.log("✔ Migraciones aplicadas");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
