import { describe, expect, it } from "vitest";
import { enteroALetras, importeConLetra } from "@/lib/money/words";
import { formatFolio, normalizePrefix, suggestPrefix } from "@/lib/utils/folio";
import { allowedTransitions, canTransition, displayStatus } from "@/features/quotes/status";
import { pickReferenceVersion } from "@/features/quotes/service";
import { addDays, formatCalendarDate, fromDateTimeLocalValue, todayInTimeZone, yearInTimeZone } from "@/lib/utils/dates";
import { quotePdfFilename, receiptPdfFilename, safeFilename } from "@/lib/utils/text";
import { contrastRatio, ensureContrast, normalizeHex, readableTextOn } from "@/lib/utils/color";

describe("importe con letra", () => {
  it.each([
    [0, "CERO"],
    [1, "UNO"],
    [16, "DIECISÉIS"],
    [21, "VEINTIUNO"],
    [100, "CIEN"],
    [101, "CIENTO UNO"],
    [1500, "MIL QUINIENTOS"],
    [21000, "VEINTIÚN MIL"],
    [1856, "MIL OCHOCIENTOS CINCUENTA Y SEIS"],
    [1_000_000, "UN MILLÓN"],
    [2_500_000, "DOS MILLONES QUINIENTOS MIL"],
  ])("%i => %s", (n, s) => expect(enteroALetras(n)).toBe(s));
  it("pesos y dólares", () => {
    expect(importeConLetra(150000, "MXN")).toBe("MIL QUINIENTOS PESOS 00/100 M.N.");
    expect(importeConLetra(185650, "USD")).toBe("MIL OCHOCIENTOS CINCUENTA Y SEIS DÓLARES 50/100 USD");
    expect(importeConLetra(100, "MXN")).toBe("UN PESO 00/100 M.N.");
    expect(importeConLetra(2100, "MXN")).toBe("VEINTIÚN PESOS 00/100 M.N.");
    expect(importeConLetra(100000000, "MXN")).toBe("UN MILLÓN DE PESOS 00/100 M.N.");
  });
});

describe("folios", () => {
  it("formato con relleno configurable", () => {
    expect(formatFolio("MB", 2026, 181)).toBe("MB-2026-0181");
    expect(formatFolio("REC", 2026, 11, 4)).toBe("REC-2026-0011");
    expect(formatFolio("X", 2026, 7, 6)).toBe("X-2026-000007");
  });
  it("normaliza prefijos", () => {
    expect(normalizePrefix(" mb ")).toBe("MB");
    expect(normalizePrefix("Ñandú 2")).toBe("NANDU2");
    expect(() => normalizePrefix("!!!")).toThrow();
  });
  it("sugiere prefijos", () => {
    expect(suggestPrefix("Media Demo")).toBe("MD");
    expect(suggestPrefix("Estudio")).toBe("EST");
  });
  it("rechaza números inválidos", () => {
    expect(() => formatFolio("A", 2026, 0)).toThrow();
  });
});

describe("estados de cotización", () => {
  it("transiciones permitidas", () => {
    expect(canTransition("DRAFT", "SENT")).toBe(true);
    expect(canTransition("SENT", "APPROVED")).toBe(true);
    expect(canTransition("SENT", "REJECTED")).toBe(true);
    expect(canTransition("SENT", "EXPIRED")).toBe(true);
  });
  it("transiciones absurdas rechazadas", () => {
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("APPROVED", "DRAFT")).toBe(false);
    expect(canTransition("REJECTED", "APPROVED")).toBe(false);
    expect(allowedTransitions("APPROVED")).toEqual([]);
  });
  it("vencida derivada por fecha", () => {
    expect(displayStatus("SENT", "2026-01-01", "2026-02-01")).toBe("EXPIRED");
    expect(displayStatus("SENT", "2026-03-01", "2026-02-01")).toBe("SENT");
    expect(displayStatus("APPROVED", "2026-01-01", "2026-02-01")).toBe("APPROVED");
  });
  it("versión de referencia para saldo", () => {
    expect(pickReferenceVersion([{ status: "APPROVED", versionNumber: 1 }, { status: "DRAFT", versionNumber: 2 }])?.versionNumber).toBe(1);
    expect(pickReferenceVersion([{ status: "SENT", versionNumber: 1 }, { status: "SENT", versionNumber: 2 }])?.versionNumber).toBe(2);
    expect(pickReferenceVersion([{ status: "DRAFT", versionNumber: 1 }])).toBeNull();
  });
});

describe("fechas", () => {
  it("año de folio según zona horaria de la organización", () => {
    // 2027-01-01 03:00 UTC sigue siendo 31 dic 2026 en Ciudad de México.
    const d = new Date("2027-01-01T03:00:00Z");
    expect(yearInTimeZone("America/Mexico_City", d)).toBe(2026);
    expect(todayInTimeZone("America/Mexico_City", d)).toBe("2026-12-31");
  });
  it("suma días sin desfase UTC", () => {
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
  });
  it("formato de fecha de calendario", () => {
    expect(formatCalendarDate("2026-11-05")).toBe("5 de noviembre de 2026");
  });
  it("datetime-local en zona horaria", () => {
    expect(fromDateTimeLocalValue("2026-11-05T10:30", "America/Mexico_City").toISOString()).toBe("2026-11-05T16:30:00.000Z");
  });
});

describe("nombres de archivo", () => {
  it("sanitiza", () => {
    expect(safeFilename("Industria del Golfo / Demo: ñ")).toBe("Industria_del_Golfo_Demo_n");
    expect(quotePdfFilename("MD-2026-0001", "Industria del Golfo Demo", 2)).toBe(
      "Cotizacion_MD-2026-0001_Industria_del_Golfo_Demo_v2.pdf",
    );
    expect(receiptPdfFilename("REC-2026-0011", "José Pérez")).toBe("Recibo_REC-2026-0011_Jose_Perez.pdf");
  });
});

describe("contraste de color", () => {
  it("ajusta colores ilegibles", () => {
    expect(ensureContrast("#FFFF00", "#FFFFFF")).toBe("#1C1C1B");
    expect(ensureContrast("#1C1C1B", "#FFFFFF")).toBe("#1C1C1B");
    expect(readableTextOn("#000000")).toBe("#FFFFFF");
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(normalizeHex("abc")).toBe("#AABBCC");
  });
});
