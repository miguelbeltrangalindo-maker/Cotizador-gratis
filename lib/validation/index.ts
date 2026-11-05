import { z } from "zod";
import { validation } from "@/lib/errors";

/** Valida con Zod y convierte los errores a AppError VALIDATION_ERROR con mensajes por campo. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of r.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    const first = Object.values(fieldErrors)[0];
    throw validation(first ? `Revisa los datos: ${first}` : "Revisa los datos marcados.", fieldErrors);
  }
  return r.data;
}

/** Texto opcional: recorta y convierte "" en null. Longitud máxima protegida. */
export const optionalText = (max = 2000) =>
  z
    .string()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .nullable()
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const t = v.trim();
      return t === "" ? null : t;
    });

export const requiredText = (label: string, max = 500) =>
  z.string().trim().min(1, `${label} es obligatorio`).max(max, `Máximo ${max} caracteres`);

/** RFC mexicano (formato razonable; no hay validación fiscal externa). */
export const RFC_RE = /^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z\d]{2})([A\d])$/;

export const optionalRfc = z
  .string()
  .max(20)
  .optional()
  .nullable()
  .transform((v) => (v ? v.trim().toUpperCase() : null))
  .refine((v) => v === null || v === "" || RFC_RE.test(v), "RFC con formato inválido (p. ej. XAXX010101000)")
  .transform((v) => (v === "" ? null : v));

export const optionalEmail = z
  .string()
  .max(254)
  .optional()
  .nullable()
  .transform((v) => (v ? v.trim().toLowerCase() : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, "Correo inválido");

export const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color HEX inválido (#RRGGBB)");

export const decimalString = (label: string) =>
  z.union([z.string(), z.number()]).transform((v) => String(v).trim()).refine((v) => /^\d+(\.\d+)?$/.test(v.replace(/,/g, "")), `${label}: número inválido`).transform((v) => v.replace(/,/g, ""));

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

export const optionalIsoDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida");
