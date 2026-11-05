/** Normaliza un prefijo de folio: mayúsculas, letras/números/guiones, 1-12 caracteres. */
export function normalizePrefix(input: string): string {
  const p = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  if (!p) throw new Error("El prefijo de folio debe contener letras o números");
  return p;
}

/** MB-2026-0181 */
export function formatFolio(prefix: string, year: number, n: number, padding = 4): string {
  if (!Number.isInteger(n) || n < 1) throw new Error("Número de folio inválido");
  const pad = Math.min(Math.max(padding, 1), 8);
  return `${prefix}-${year}-${String(n).padStart(pad, "0")}`;
}

/** Sugiere prefijo a partir del nombre comercial: "Media Demo" -> "MD". */
export function suggestPrefix(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return "COT";
  if (words.length === 1) return words[0].slice(0, 3);
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("");
}
