import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { clients } from "@/lib/db/schema";
import type { Tx } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { CURRENCIES } from "@/lib/money";
import { assertCan, assertUuid, withTenant, type TenantContext } from "@/lib/security/tenant";
import { optionalEmail, optionalRfc, optionalText, parseInput } from "@/lib/validation";
import { audit } from "@/features/audit/service";

export const clientSchema = z.object({
  kind: z.enum(["PERSON", "COMPANY"]).optional().nullable().transform((v) => v ?? null),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  businessName: optionalText(250),
  taxId: optionalRfc,
  email: optionalEmail,
  phone: optionalText(40),
  contactName: optionalText(160),
  address: optionalText(500),
  notes: optionalText(4000),
  preferredCurrency: z.enum(CURRENCIES).optional().nullable().transform((v) => v ?? null),
});
export type ClientInput = z.input<typeof clientSchema>;
export type Client = typeof clients.$inferSelect;

export const PAGE_SIZE = 20;

/** Escapa comodines de LIKE para que la búsqueda sea literal. */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export async function listClients(
  ctx: TenantContext,
  opts: { q?: string; page?: number; archived?: boolean; pageSize?: number } = {},
) {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(100, opts.pageSize ?? PAGE_SIZE);
  return withTenant(ctx, async (tx) => {
    const conds = [eq(clients.organizationId, ctx.organizationId)];
    conds.push(opts.archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt));
    const q = opts.q?.trim().slice(0, 100);
    if (q) {
      const p = likePattern(q);
      conds.push(
        or(
          ilike(clients.name, p),
          ilike(clients.businessName, p),
          ilike(clients.taxId, p),
          ilike(clients.email, p),
          ilike(clients.contactName, p),
        )!,
      );
    }
    const where = and(...conds);
    const [{ total }] = await tx.select({ total: count() }).from(clients).where(where);
    const rows = await tx
      .select()
      .from(clients)
      .where(where)
      .orderBy(asc(sql`lower(${clients.name})`), desc(clients.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { rows, total, page, pageSize };
  });
}

export async function getClientTx(tx: Tx, ctx: TenantContext, clientId: string) {
  assertUuid(clientId, "El cliente");
  const [c] = await tx
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.organizationId)));
  if (!c) throw notFound("El cliente");
  return c;
}

export async function getClient(ctx: TenantContext, clientId: string) {
  return withTenant(ctx, (tx) => getClientTx(tx, ctx, clientId));
}

/** Posibles duplicados (mismo nombre o RFC/correo) para advertir sin prohibir. */
export async function findSimilarClients(ctx: TenantContext, input: { name: string; taxId?: string | null; email?: string | null }) {
  return withTenant(ctx, async (tx) => {
    const ors = [sql`lower(${clients.name}) = lower(${input.name.trim()})`];
    if (input.taxId) ors.push(sql`upper(${clients.taxId}) = upper(${input.taxId.trim()})`);
    if (input.email) ors.push(sql`lower(${clients.email}) = lower(${input.email.trim()})`);
    return tx
      .select({ id: clients.id, name: clients.name, taxId: clients.taxId, email: clients.email })
      .from(clients)
      .where(and(eq(clients.organizationId, ctx.organizationId), isNull(clients.archivedAt), or(...ors)))
      .limit(5);
  });
}

export async function createClient(ctx: TenantContext, input: ClientInput) {
  assertCan(ctx, "clients.manage");
  const data = parseInput(clientSchema, input);
  return withTenant(ctx, async (tx) => {
    const [c] = await tx
      .insert(clients)
      .values({ organizationId: ctx.organizationId, ...data })
      .returning();
    await audit(tx, ctx, "client.create", "client", c.id);
    return c;
  });
}

export async function updateClient(ctx: TenantContext, clientId: string, input: ClientInput) {
  assertCan(ctx, "clients.manage");
  const data = parseInput(clientSchema, input);
  return withTenant(ctx, async (tx) => {
    await getClientTx(tx, ctx, clientId);
    const [c] = await tx
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.organizationId)))
      .returning();
    await audit(tx, ctx, "client.update", "client", clientId);
    return c;
  });
}

/** Los clientes no se borran: se archivan para no romper históricos. */
export async function archiveClient(ctx: TenantContext, clientId: string, archived = true) {
  assertCan(ctx, "clients.manage");
  await withTenant(ctx, async (tx) => {
    await getClientTx(tx, ctx, clientId);
    await tx
      .update(clients)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.organizationId)));
    await audit(tx, ctx, "client.archive", "client", clientId, { archived });
  });
}
