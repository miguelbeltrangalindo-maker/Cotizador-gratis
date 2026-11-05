/**
 * Importe con letra en español (México), p. ej.:
 *   150000 MXN -> "MIL QUINIENTOS PESOS 00/100 M.N."
 *   185600 USD -> "MIL OCHOCIENTOS CINCUENTA Y SEIS DÓLARES 00/100 USD"
 */
const UNIDADES = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
  "VEINTIUNO",
  "VEINTIDÓS",
  "VEINTITRÉS",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISÉIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

function hasta999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (c > 0) parts.push(CENTENAS[c]);
  if (r > 0) {
    if (r < 30) parts.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`);
    }
  }
  return parts.join(" ");
}

/** Apocopa "UNO" final cuando antecede a un sustantivo (VEINTIUNO -> VEINTIÚN, UNO -> UN). */
function apocopar(s: string): string {
  if (s.endsWith("VEINTIUNO")) return s.slice(0, -"VEINTIUNO".length) + "VEINTIÚN";
  if (s.endsWith("UNO")) return s.slice(0, -3) + "UN";
  return s;
}

export function enteroALetras(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error("Número inválido");
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (millones > 0) {
    if (millones === 1) parts.push("UN MILLÓN");
    else parts.push(`${apocopar(enteroALetras(millones))} MILLONES`);
  }
  if (miles > 0) {
    if (miles === 1) parts.push("MIL");
    else parts.push(`${apocopar(hasta999(miles))} MIL`);
  }
  if (resto > 0) parts.push(hasta999(resto));
  return parts.join(" ");
}

export function importeConLetra(minor: number, currency: string): string {
  const entero = Math.floor(minor / 100);
  const centavos = String(minor % 100).padStart(2, "0");
  let palabras = enteroALetras(entero);
  const esMillonExacto = entero >= 1_000_000 && entero % 1_000_000 === 0;
  if (currency === "MXN") {
    palabras = entero === 1 ? "UN PESO" : `${apocopar(palabras)}${esMillonExacto ? " DE" : ""} PESOS`;
    return `${palabras} ${centavos}/100 M.N.`;
  }
  if (currency === "USD") {
    palabras = entero === 1 ? "UN DÓLAR" : `${apocopar(palabras)}${esMillonExacto ? " DE" : ""} DÓLARES`;
    return `${palabras} ${centavos}/100 USD`;
  }
  return `${palabras} ${centavos}/100 ${currency}`;
}
