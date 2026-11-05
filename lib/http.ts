import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getTenantOrNull } from "@/lib/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import type { TenantContext } from "@/lib/security/tenant";

const STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
};

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export function jsonError(code: keyof typeof STATUS, message: string, errorId?: string) {
  return NextResponse.json({ error: { code, message, errorId } }, { status: STATUS[code], headers: PRIVATE_HEADERS });
}

/**
 * Envoltura para route handlers privados: autentica, resuelve el tenant en servidor,
 * aplica rate limit y convierte errores (NOT_FOUND para recursos ajenos, sin filtrar datos).
 */
export async function privateRoute(
  rate: { key: string; limit: number; windowSeconds: number },
  fn: (ctx: TenantContext) => Promise<Response>,
): Promise<Response> {
  try {
    const t = await getTenantOrNull();
    if (!t) return jsonError("UNAUTHORIZED", "Inicia sesión para continuar.");
    await enforceRateLimit(`${rate.key}:${t.ctx.userId}`, rate.limit, rate.windowSeconds);
    return await fn(t.ctx);
  } catch (e) {
    if (e instanceof AppError) return jsonError(e.code, e.message);
    const errorId = randomUUID().slice(0, 8);
    console.error(`[error ${errorId}]`, e);
    return jsonError("INTERNAL_ERROR", "Error inesperado.", errorId);
  }
}

export function fileResponse(body: Buffer, opts: { contentType: string; filename?: string; download?: boolean }) {
  const headers: Record<string, string> = { ...PRIVATE_HEADERS, "Content-Type": opts.contentType, "Content-Length": String(body.length) };
  if (opts.filename) {
    const ascii = opts.filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
    headers["Content-Disposition"] = `${opts.download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(opts.filename)}`;
  }
  return new Response(new Uint8Array(body), { status: 200, headers });
}
