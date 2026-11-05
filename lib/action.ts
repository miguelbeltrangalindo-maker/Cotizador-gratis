import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { AppError, type ActionResult } from "@/lib/errors";

/**
 * Ejecuta una acción de servidor y convierte errores en resultados estables.
 * Errores inesperados: se registran con un identificador trazable y NO se expone el stack.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) {
      return { ok: false, code: e.code, message: e.message, fieldErrors: e.fieldErrors };
    }
    const errorId = randomUUID().slice(0, 8);
    console.error(`[error ${errorId}]`, e);
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: `Ocurrió un error inesperado. Inténtalo de nuevo (código ${errorId}).`,
      errorId,
    };
  }
}

export function formString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function formBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
