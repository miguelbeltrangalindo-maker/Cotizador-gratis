import { sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { AppError, forbidden } from "@/lib/errors";

export const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MEMBER: "Colaborador",
};

/**
 * Contexto resuelto SIEMPRE en servidor a partir de la sesión y la membresía.
 * Nunca se construye con datos enviados por el navegador.
 */
export interface TenantContext {
  userId: string;
  organizationId: string;
  role: Role;
  timezone: string;
}

export type Permission =
  | "org.manage"
  | "members.manage"
  | "brands.manage"
  | "clients.manage"
  | "catalog.manage"
  | "customFields.manage"
  | "documents.write"
  | "receipts.void"
  | "data.export";

const MATRIX: Record<Role, Permission[]> = {
  OWNER: [
    "org.manage",
    "members.manage",
    "brands.manage",
    "clients.manage",
    "catalog.manage",
    "customFields.manage",
    "documents.write",
    "receipts.void",
    "data.export",
  ],
  ADMIN: [
    "brands.manage",
    "clients.manage",
    "catalog.manage",
    "customFields.manage",
    "documents.write",
    "receipts.void",
    "data.export",
  ],
  MEMBER: ["clients.manage", "documents.write"],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function assertCan(ctx: Pick<TenantContext, "role">, permission: Permission) {
  if (!can(ctx.role, permission)) throw forbidden();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Lanza NOT_FOUND (no 400) ante ids mal formados para no filtrar información. */
export function assertUuid(v: unknown, what = "El recurso"): asserts v is string {
  if (!isUuid(v)) throw new AppError("NOT_FOUND", `${what} no existe o no tienes acceso.`);
}

/**
 * Ejecuta `fn` en una transacción con el contexto de organización fijado para RLS
 * (`app.org_id`, `app.user_id`). Las consultas además filtran explícitamente por
 * organization_id (defensa en profundidad).
 */
export async function withTenant<T>(ctx: Pick<TenantContext, "organizationId" | "userId">, fn: (tx: Tx) => Promise<T>) {
  assertUuid(ctx.organizationId);
  assertUuid(ctx.userId);
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.org_id', ${ctx.organizationId}, true), set_config('app.user_id', ${ctx.userId}, true)`,
    );
    return fn(tx);
  });
}

/** Transacción con solo el usuario fijado (antes de tener organización activa). */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>) {
  assertUuid(userId);
  return db().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true), set_config('app.org_id', '', true)`);
    return fn(tx);
  });
}
