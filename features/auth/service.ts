/**
 * Servicio de cuentas y sesiones (independiente de Next.js para poder probarse).
 * Sesiones: token aleatorio de 256 bits en cookie HttpOnly; en BD solo se guarda
 * HMAC-SHA256(token, AUTH_SECRET).
 */
import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { AppError, validation } from "@/lib/errors";
import { hashPassword, passwordProblems, verifyDummy, verifyPassword } from "./password";

export const SESSION_TTL_DAYS = 30;
const SESSION_REFRESH_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHmac("sha256", env().AUTH_SECRET).update(token).digest("base64url");
}

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(120),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(254),
  password: z.string().max(200),
});

export async function registerUser(input: z.input<typeof registerSchema>) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    throw validation("Revisa los datos marcados.", fieldErrors);
  }
  const problem = passwordProblems(parsed.data.password);
  if (problem) throw validation(problem, { password: problem });
  const passwordHash = await hashPassword(parsed.data.password);
  const existing = await db()
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email}`);
  if (existing.length > 0) {
    throw validation("No fue posible crear la cuenta con ese correo. Si ya tienes cuenta, inicia sesión.", {
      email: "Este correo no está disponible.",
    });
  }
  const [user] = await db()
    .insert(users)
    .values({ name: parsed.data.name, email: parsed.data.email, passwordHash })
    .returning({ id: users.id, email: users.email, name: users.name });
  return user;
}

export async function authenticate(emailInput: string, password: string) {
  const email = String(emailInput ?? "").trim().toLowerCase();
  const [user] = await db()
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  if (!user) {
    await verifyDummy(password);
    return null;
  }
  const ok = await verifyPassword(user.passwordHash, password);
  return ok ? { id: user.id, email: user.email, name: user.name } : null;
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db()
    .insert(sessions)
    .values({ userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 300) ?? null });
  return { token, expiresAt };
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  activeOrganizationId: string | null;
  expiresAt: Date;
}

export async function validateSessionToken(token: string): Promise<SessionInfo | null> {
  if (!token || token.length > 200) return null;
  const rows = await db()
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      activeOrganizationId: sessions.activeOrganizationId,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      email: users.email,
      name: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  const row = rows[0];
  if (!row) return null;
  // Renovación deslizante, como máximo una vez al día.
  if (Date.now() - row.lastSeenAt.getTime() > SESSION_REFRESH_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await db().update(sessions).set({ lastSeenAt: new Date(), expiresAt }).where(eq(sessions.id, row.sessionId));
    row.expiresAt = expiresAt;
  }
  return {
    sessionId: row.sessionId,
    userId: row.userId,
    email: row.email,
    name: row.name,
    activeOrganizationId: row.activeOrganizationId,
    expiresAt: row.expiresAt,
  };
}

export async function invalidateSession(sessionId: string) {
  await db().delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateAllUserSessions(userId: string) {
  await db().delete(sessions).where(eq(sessions.userId, userId));
}

export async function setSessionActiveOrganization(sessionId: string, organizationId: string | null) {
  await db().update(sessions).set({ activeOrganizationId: organizationId }).where(eq(sessions.id, sessionId));
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const [user] = await db().select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("UNAUTHORIZED", "Sesión inválida.");
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw validation("La contraseña actual no es correcta.", { currentPassword: "Contraseña incorrecta" });
  }
  const problem = passwordProblems(newPassword);
  if (problem) throw validation(problem, { newPassword: problem });
  await db()
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateProfileName(userId: string, name: string) {
  const n = name.trim();
  if (n.length < 2 || n.length > 120) throw validation("Escribe un nombre válido.", { name: "Nombre inválido" });
  await db().update(users).set({ name: n, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** Uso exclusivo del CLI local de restablecimiento (sin SMTP). */
export async function adminResetPassword(email: string, newPassword: string) {
  const problem = passwordProblems(newPassword);
  if (problem) throw new Error(problem);
  const res = await db()
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .returning({ id: users.id });
  if (res.length === 0) throw new Error("No existe una cuenta con ese correo");
  await invalidateAllUserSessions(res[0].id);
}
