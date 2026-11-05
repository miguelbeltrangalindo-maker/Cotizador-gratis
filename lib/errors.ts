/** Errores de dominio estables y mensajes amigables. */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "El recurso") => new AppError("NOT_FOUND", `${what} no existe o no tienes acceso.`);
export const forbidden = (msg = "No tienes permiso para realizar esta acción.") => new AppError("FORBIDDEN", msg);
export const conflict = (msg: string) => new AppError("CONFLICT", msg);
export const validation = (msg: string, fieldErrors?: Record<string, string>) =>
  new AppError("VALIDATION_ERROR", msg, fieldErrors);

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string>; errorId?: string };
