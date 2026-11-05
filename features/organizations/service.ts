import { randomUUID, randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { memberships, organizations, users } from "@/lib/db/schema";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { assertCan, assertUuid, ROLES, withTenant, withUser, type Role, type TenantContext } from "@/lib/security/tenant";
import { slugify } from "@/lib/utils/text";
import { audit } from "@/features/audit/service";
import { parseInput } from "@/lib/validation";
import { CURRENCIES } from "@/lib/money";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";

export const TIMEZONES = TIMEZONE_OPTIONS.map((t) => t.value) as [TimezoneValue, ...TimezoneValue[]];
type TimezoneValue = (typeof TIMEZONE_OPTIONS)[number]["value"];

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de tu empresa").max(160),
  country: z.string().trim().length(2).default("MX"),
  timezone: z.enum(TIMEZONES).default("America/Mexico_City"),
  defaultCurrency: z.enum(CURRENCIES).default("MXN"),
});

export interface MyOrganization {
  id: string;
  name: string;
  role: Role;
  timezone: string;
}

export async function listMyOrganizations(userId: string): Promise<MyOrganization[]> {
  return withUser(userId, async (tx) => {
    const rows = await tx
      .select({ id: organizations.id, name: organizations.name, role: memberships.role, timezone: organizations.timezone })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(memberships.joinedAt));
    return rows.map((r) => ({ ...r, role: r.role as Role }));
  });
}

/**
 * Resuelve el contexto de tenant verificando la membresía en servidor.
 * Si la organización preferida no es válida, usa la primera disponible.
 */
export async function resolveTenantContext(userId: string, preferredOrgId: string | null): Promise<TenantContext | null> {
  const orgs = await listMyOrganizations(userId);
  if (orgs.length === 0) return null;
  const org = orgs.find((o) => o.id === preferredOrgId) ?? orgs[0];
  return { userId, organizationId: org.id, role: org.role, timezone: org.timezone };
}

/** Comprueba que el usuario es miembro de la organización; si no, NOT_FOUND. */
export async function assertOrganizationMember(userId: string, organizationId: string): Promise<TenantContext> {
  assertUuid(organizationId, "La organización");
  const orgs = await listMyOrganizations(userId);
  const org = orgs.find((o) => o.id === organizationId);
  if (!org) throw notFound("La organización");
  return { userId, organizationId: org.id, role: org.role, timezone: org.timezone };
}

export async function createOrganization(userId: string, input: z.input<typeof organizationSchema>) {
  const data = parseInput(organizationSchema, input);
  const id = randomUUID();
  const slug = `${slugify(data.name)}-${randomBytes(3).toString("hex")}`;
  await withTenant({ organizationId: id, userId }, async (tx) => {
    await tx.insert(organizations).values({ id, slug, ...data });
    await tx.insert(memberships).values({ organizationId: id, userId, role: "OWNER" });
    await audit(tx, { organizationId: id, userId }, "organization.create", "organization", id);
  });
  return { id };
}

export async function getOrganization(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, ctx.organizationId));
    if (!org) throw notFound("La organización");
    return org;
  });
}

export async function updateOrganization(ctx: TenantContext, input: z.input<typeof organizationSchema>) {
  assertCan(ctx, "org.manage");
  const data = parseInput(organizationSchema, input);
  await withTenant(ctx, async (tx) => {
    await tx
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, ctx.organizationId));
    await audit(tx, ctx, "organization.update", "organization", ctx.organizationId);
  });
}

export async function listMembers(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx
      .select({
        id: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        joinedAt: memberships.joinedAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.organizationId, ctx.organizationId))
      .orderBy(asc(memberships.joinedAt));
    return rows.map((r) => ({ ...r, role: r.role as Role }));
  });
}

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  role: z.enum(["ADMIN", "MEMBER"]),
});

/**
 * Agrega a una persona que YA tiene cuenta. (Las invitaciones por correo requieren
 * SMTP y quedan para una fase posterior.)
 */
export async function addMember(ctx: TenantContext, input: z.input<typeof addMemberSchema>) {
  assertCan(ctx, "members.manage");
  const data = parseInput(addMemberSchema, input);
  return withTenant(ctx, async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${data.email}`);
    if (!user) {
      throw new AppError(
        "VALIDATION_ERROR",
        "No encontramos una cuenta con ese correo. Pide a la persona que se registre primero.",
        { email: "Sin cuenta registrada" },
      );
    }
    const existing = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.organizationId, ctx.organizationId), eq(memberships.userId, user.id)));
    if (existing.length) throw conflict("Esa persona ya pertenece a la organización.");
    await tx.insert(memberships).values({ organizationId: ctx.organizationId, userId: user.id, role: data.role });
    await audit(tx, ctx, "member.add", "user", user.id, { role: data.role });
  });
}

export async function changeMemberRole(ctx: TenantContext, membershipId: string, role: Role) {
  assertCan(ctx, "members.manage");
  assertUuid(membershipId, "El integrante");
  if (!ROLES.includes(role)) throw forbidden();
  await withTenant(ctx, async (tx) => {
    const [m] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.id, membershipId), eq(memberships.organizationId, ctx.organizationId)));
    if (!m) throw notFound("El integrante");
    if (m.role === "OWNER" && role !== "OWNER") await assertAnotherOwner(tx, ctx.organizationId, m.id);
    await tx.update(memberships).set({ role }).where(eq(memberships.id, m.id));
    await audit(tx, ctx, "member.role_change", "user", m.userId, { role });
  });
}

export async function removeMember(ctx: TenantContext, membershipId: string) {
  assertCan(ctx, "members.manage");
  assertUuid(membershipId, "El integrante");
  await withTenant(ctx, async (tx) => {
    const [m] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.id, membershipId), eq(memberships.organizationId, ctx.organizationId)));
    if (!m) throw notFound("El integrante");
    if (m.role === "OWNER") await assertAnotherOwner(tx, ctx.organizationId, m.id);
    await tx.delete(memberships).where(eq(memberships.id, m.id));
    await audit(tx, ctx, "member.remove", "user", m.userId);
  });
}

async function assertAnotherOwner(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  organizationId: string,
  excludingMembershipId: string,
) {
  const owners = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.role, "OWNER")));
  if (owners.filter((o) => o.id !== excludingMembershipId).length === 0) {
    throw conflict("La organización debe conservar al menos un propietario.");
  }
}
