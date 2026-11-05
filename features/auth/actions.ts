"use server";

import { redirect } from "next/navigation";
import { formString, runAction } from "@/lib/action";
import { AppError, type ActionResult } from "@/lib/errors";
import { clientIp } from "@/lib/request";
import { clearRateLimit, enforceRateLimit } from "@/lib/security/rate-limit";
import { clearSessionCookie, getSession, requireUser, startSession } from "@/lib/session";
import { authenticate, changePassword, invalidateSession, registerUser, updateProfileName } from "./service";

export async function registerAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await runAction(async () => {
    const ip = await clientIp();
    await enforceRateLimit(`register:${ip}`, 10, 60 * 60);
    const user = await registerUser({
      name: formString(fd, "name"),
      email: formString(fd, "email"),
      password: formString(fd, "password"),
    });
    await startSession(user.id);
    return undefined;
  });
  if (res.ok) redirect("/bienvenida");
  return res;
}

export async function loginAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = formString(fd, "email").trim().toLowerCase();
  const res = await runAction(async () => {
    const ip = await clientIp();
    await enforceRateLimit(`login-ip:${ip}`, 30, 15 * 60);
    await enforceRateLimit(`login:${ip}:${email}`, 8, 15 * 60);
    const user = await authenticate(email, formString(fd, "password"));
    // Mensaje genérico: no revela si el correo existe.
    if (!user) throw new AppError("UNAUTHORIZED", "Correo o contraseña incorrectos.");
    await clearRateLimit(`login:${ip}:${email}`);
    await startSession(user.id);
    return undefined;
  });
  if (res.ok) {
    const next = formString(fd, "next");
    redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/inicio");
  }
  return res;
}

export async function logoutAction() {
  const s = await getSession();
  if (s) await invalidateSession(s.sessionId);
  await clearSessionCookie();
  redirect("/iniciar-sesion");
}

export async function updateProfileAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireUser();
    await updateProfileName(s.userId, formString(fd, "name"));
  });
}

export async function changePasswordAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireUser();
    const ip = await clientIp();
    await enforceRateLimit(`pwd:${ip}:${s.userId}`, 10, 15 * 60);
    if (formString(fd, "newPassword") !== formString(fd, "confirmPassword")) {
      throw new AppError("VALIDATION_ERROR", "Las contraseñas nuevas no coinciden.", { confirmPassword: "No coincide" });
    }
    await changePassword(s.userId, formString(fd, "currentPassword"), formString(fd, "newPassword"));
  });
}
