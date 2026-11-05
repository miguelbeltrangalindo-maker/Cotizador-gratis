import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Health check: verifica conexión a base de datos. No expone datos. */
export async function GET() {
  try {
    await db().execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
