import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isProduction } from "@/lib/env";
import { createSession, SESSION_TTL_DAYS, validateSessionToken, type SessionInfo } from "@/features/auth/service";
import { listMyOrganizations, resolveTenantContext, type MyOrganization } from "@/features/organizations/service";
import type { TenantContext } from "@/lib/security/tenant";

export const SESSION_COOKIE = isProduction() ? "__Host-cotizador_session" : "cotizador_session";

export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

export async function startSession(userId: string) {
  const ua = (await headers()).get("user-agent");
  const { token, expiresAt } = await createSession(userId, ua);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<SessionInfo> {
  const s = await getSession();
  if (!s) redirect("/iniciar-sesion?expirada=1");
  return s;
}

export interface AppContext {
  session: SessionInfo;
  ctx: TenantContext;
  organizations: MyOrganization[];
  activeOrganization: MyOrganization;
}

/** Usuario autenticado + organización activa verificada por membresía en servidor. */
export const requireTenant = cache(async (): Promise<AppContext> => {
  const session = await requireUser();
  const ctx = await resolveTenantContext(session.userId, session.activeOrganizationId);
  if (!ctx) redirect("/bienvenida");
  const organizations = await listMyOrganizations(session.userId);
  const activeOrganization = organizations.find((o) => o.id === ctx.organizationId)!;
  return { session, ctx, organizations, activeOrganization };
});

/** Para route handlers: devuelve null en lugar de redirigir. */
export async function getTenantOrNull(): Promise<{ session: SessionInfo; ctx: TenantContext } | null> {
  const session = await getSession();
  if (!session) return null;
  const ctx = await resolveTenantContext(session.userId, session.activeOrganizationId);
  if (!ctx) return null;
  return { session, ctx };
}
