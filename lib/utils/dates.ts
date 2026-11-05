/** Utilidades de fecha. Fechas de calendario (sin hora) se manejan como "YYYY-MM-DD". */

export const DEFAULT_TIMEZONE = "America/Mexico_City";

/** Fecha de calendario actual en la zona horaria de la organización. */
export function todayInTimeZone(timeZone = DEFAULT_TIMEZONE, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Año para folios: se determina en la zona horaria de la organización. */
export function yearInTimeZone(timeZone = DEFAULT_TIMEZONE, now = new Date()): number {
  return Number(todayInTimeZone(timeZone, now).slice(0, 4));
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "5 de noviembre de 2026" a partir de "2026-11-05" (sin desplazamientos de zona). */
export function formatCalendarDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatShortCalendarDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Instante en la zona horaria de la organización. */
export function formatInstant(date: Date | string, timeZone = DEFAULT_TIMEZONE, withTime = true): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone,
  }).format(d);
}

/** Valor para <input type="datetime-local"> en la zona de la organización. */
export function toDateTimeLocalValue(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Convierte "YYYY-MM-DDTHH:mm" interpretado en `timeZone` a un instante UTC. */
export function fromDateTimeLocalValue(value: string, timeZone = DEFAULT_TIMEZONE): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error("Fecha y hora inválidas");
  const [, y, mo, d, h, mi] = m.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Calcula el desfase de la zona en ese instante (dos pasadas para DST).
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const local = toDateTimeLocalValue(new Date(guess), timeZone);
    const [ly, lmo, ld, lh, lmi] = local.split(/[-T:]/).map(Number);
    const diff = Date.UTC(ly, lmo - 1, ld, lh, lmi) - asUtc;
    guess -= diff;
  }
  return new Date(guess);
}
