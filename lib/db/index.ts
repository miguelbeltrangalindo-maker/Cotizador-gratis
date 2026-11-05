import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "@/lib/env";

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Tx;

const globalForDb = globalThis as unknown as { __cotizadorPool?: Pool; __cotizadorDb?: Database };

/** Conexión con el rol de aplicación (sujeto a RLS). */
export function db(): Database {
  if (!globalForDb.__cotizadorDb) {
    const pool = new Pool({ connectionString: env().DATABASE_URL, max: 10 });
    globalForDb.__cotizadorPool = pool;
    globalForDb.__cotizadorDb = drizzle(pool, { schema });
  }
  return globalForDb.__cotizadorDb;
}

export async function closeDb() {
  await globalForDb.__cotizadorPool?.end();
  globalForDb.__cotizadorPool = undefined;
  globalForDb.__cotizadorDb = undefined;
}

export { schema };
