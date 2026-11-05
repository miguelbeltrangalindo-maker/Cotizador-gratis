import { sql } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { formatFolio } from "@/lib/utils/folio";

export type DocumentType = "QUOTE" | "RECEIPT";

/**
 * Reserva el siguiente número de folio de forma atómica dentro de la transacción.
 * El UPSERT bloquea la fila de la secuencia hasta el COMMIT, por lo que dos usuarios
 * emitiendo al mismo tiempo obtienen números distintos. Además existe UNIQUE(org, folio).
 * Los números nunca se reutilizan (una cancelación no los libera).
 */
export async function generateNextFolio(
  tx: Tx,
  args: { organizationId: string; prefix: string; documentType: DocumentType; year: number; padding: number },
): Promise<{ folio: string; number: number }> {
  const res = await tx.execute<{ last_number: number }>(sql`
    insert into number_sequences (organization_id, prefix, document_type, year, last_number)
    values (${args.organizationId}, ${args.prefix}, ${args.documentType}, ${args.year}, 1)
    on conflict (organization_id, prefix, document_type, year)
    do update set last_number = number_sequences.last_number + 1
    returning last_number
  `);
  const n = Number(res.rows[0].last_number);
  return { folio: formatFolio(args.prefix, args.year, n, args.padding), number: n };
}
