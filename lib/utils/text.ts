/** Slug interno (no visible): minúsculas, sin acentos. */
export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "org"
  );
}

/** Nombre de archivo seguro para cualquier sistema operativo. */
export function safeFilename(input: string, maxLength = 60): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ñ/gi, "n")
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, maxLength) || "documento"
  );
}

export function quotePdfFilename(folio: string | null, clientName: string | null, version: number): string {
  return `Cotizacion_${safeFilename(folio ?? "BORRADOR", 30)}_${safeFilename(clientName ?? "Cliente", 40)}_v${version}.pdf`;
}

export function receiptPdfFilename(folio: string, payerName: string): string {
  return `Recibo_${safeFilename(folio, 30)}_${safeFilename(payerName, 40)}.pdf`;
}

/** Iniciales para logos ausentes: "Media Demo" -> "MD". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Texto nulo si está vacío tras recortar. */
export function emptyToNull(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
