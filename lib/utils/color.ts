/** Utilidades de color y contraste (WCAG). */

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function normalizeHex(input: string, fallback = "#1C1C1B"): string {
  let s = input.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return HEX_RE.test(s) ? s.toUpperCase() : fallback;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Texto legible sobre un fondo: blanco o casi negro según contraste. */
export function readableTextOn(bg: string): string {
  return contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, "#1C1C1B") ? "#FFFFFF" : "#1C1C1B";
}

/**
 * Asegura que `fg` sea legible sobre `bg` (ratio mínimo, por defecto 4.5 AA).
 * Si no lo es, devuelve el color de texto legible por defecto.
 */
export function ensureContrast(fg: string, bg = "#FFFFFF", min = 4.5): string {
  return contrastRatio(fg, bg) >= min ? normalizeHex(fg) : readableTextOn(bg);
}

/** Mezcla un color con blanco (0 = color, 1 = blanco), útil para fondos suaves. */
export function tint(hex: string, amount: number): string {
  const h = normalizeHex(hex);
  const mix = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${mix(1)}${mix(3)}${mix(5)}`.toUpperCase();
}
