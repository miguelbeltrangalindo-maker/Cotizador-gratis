import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Límite de intentos con ventana fija, persistido en PostgreSQL (funciona con
 * varias instancias del servidor). Operación atómica con INSERT ... ON CONFLICT.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const res = await db().execute<{ count: number }>(sql`
    insert into rate_limits (key, count, reset_at)
    values (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    on conflict (key) do update set
      count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at < now() then now() + make_interval(secs => ${windowSeconds}) else rate_limits.reset_at end
    returning count
  `);
  const count = Number(res.rows[0]?.count ?? 0);
  return count <= limit;
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  if (!(await hitRateLimit(key, limit, windowSeconds))) {
    throw new AppError("RATE_LIMIT", "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
  }
}

export async function clearRateLimit(key: string) {
  await db().execute(sql`delete from rate_limits where key = ${key}`);
}
