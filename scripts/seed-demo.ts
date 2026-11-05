/**
 * Datos de demostración (SOLO desarrollo/pruebas). Uso: npm run db:seed:demo
 * Requiere ENABLE_DEMO_SEED=true y NODE_ENV distinto de production.
 * Usa los mismos servicios que la aplicación (rol sin privilegios + RLS).
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, closeDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { registerUser } from "@/features/auth/service";
import { assertOrganizationMember, createOrganization } from "@/features/organizations/service";
import { createBrand } from "@/features/brands/service";
import { createClient } from "@/features/clients/service";
import { createCatalogItem } from "@/features/catalog/service";
import { changeQuoteStatus, createQuote, createQuoteVersion, getEditorData, saveDraft } from "@/features/quotes/service";
import { issueReceipt } from "@/features/receipts/service";
import { addDays, todayInTimeZone } from "@/lib/utils/dates";
import type { TenantContext } from "@/lib/security/tenant";

export const DEMO_PASSWORD = "DemoLocal-2026";
export const DEMO_A = "demo-a@cotizador.local";
export const DEMO_B = "demo-b@cotizador.local";

async function ensureUser(name: string, email: string) {
  const existing = await db().execute(sql`select id from users where lower(email) = ${email}`);
  if (existing.rows.length) return { id: String((existing.rows[0] as { id: string }).id), existed: true };
  const u = await registerUser({ name, email, password: DEMO_PASSWORD });
  return { id: u.id, existed: false };
}

async function draftFrom(ctx: TenantContext, quoteId: string, patch: Record<string, unknown>) {
  const e = await getEditorData(ctx, quoteId);
  await saveDraft(ctx, quoteId, e.version.id, e.version.revision, { ...e.draft, ...patch } as never);
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEMO_SEED !== "true") {
    throw new Error("Seed demo deshabilitado. Define ENABLE_DEMO_SEED=true y no uses NODE_ENV=production.");
  }
  const a = await ensureUser("Ana Demo", DEMO_A);
  const b = await ensureUser("Bruno Demo", DEMO_B);
  if (a.existed || b.existed) {
    console.log("ℹ Los usuarios demo ya existen. Para empezar de cero: npm run db:reset:dev && npm run db:seed:demo");
    return;
  }
  const today = todayInTimeZone();

  // ---------------- Organización A ----------------
  const orgA = await createOrganization(a.id, { name: "Estudio Creativo Demo" });
  const ctxA = await assertOrganizationMember(a.id, orgA.id);
  const brandA = await createBrand(ctxA, {
    name: "Media Demo",
    legalName: "Estudio Creativo Demo S.A. de C.V.",
    email: "hola@mediademo.local",
    phone: "55 0000 0000",
    website: "mediademo.local",
    address: "Av. Ejemplo 123, Col. Centro, Ciudad de México",
    colorPrimary: "#0E5E6F",
    colorAccent: "#D9822B",
    quotePrefix: "MD",
    receiptPrefix: "REC",
    defaultCurrency: "USD",
    defaultTaxMode: "EXCLUSIVE",
    defaultTaxRate: 16,
    pdfTemplate: "CREATIVE",
    defaultPaymentTerms: "50 % de anticipo para reservar fecha y 50 % contra entrega del material.",
    signatureName: "Ana Demo",
    signatureTitle: "Dirección de proyectos",
    footerText: "Gracias por su confianza.",
  });
  const clientA = await createClient(ctxA, {
    name: "Industria del Golfo Demo",
    businessName: "Industria del Golfo Demo S.A. de C.V.",
    taxId: "IGD010101AB1",
    email: "compras@golfodemo.local",
    contactName: "Laura Martínez",
    preferredCurrency: "USD",
  });
  await createCatalogItem(ctxA, { title: "Fotografía de producto", description: "Jornada de fotografía con iluminación de estudio.", unit: "jornada", suggestedPrice: "300", currency: "USD", taxMode: "EXCLUSIVE", taxRate: "16" });
  await createCatalogItem(ctxA, { title: "Video promocional", description: "Pieza de 60 segundos con edición y musicalización.", unit: "pieza", suggestedPrice: "350", currency: "USD", taxMode: "EXCLUSIVE", taxRate: "16" });

  // Cotización A (USD): 3×300 + 2×350 = 1,600 USD + IVA 16 % = 1,856 USD. V1 enviada, V2 enviada.
  const qa = await createQuote(ctxA, { brandId: brandA.id, clientId: clientA.id });
  const g1 = randomUUID();
  await draftFrom(ctxA, qa.quoteId, {
    title: "Campaña audiovisual de lanzamiento de la nueva línea de productos industriales — temporada primavera-verano",
    serviceDescription:
      "Producción integral de material fotográfico y audiovisual para catálogo impreso, sitio web y redes sociales.\n\nIncluye preproducción, scouting de locaciones, dirección de arte, producción en planta y postproducción.",
    location: "Planta Altamira, Tamaulipas",
    duration: "3 jornadas de producción + 2 semanas de postproducción",
    validUntil: addDays(today, 15),
    currency: "USD",
    groups: [{ id: g1, title: "Producción", showSubtotal: true }],
    items: [
      { id: randomUUID(), groupId: g1, description: "Servicio de fotografía de producto en planta\nIncluye equipo de iluminación y retoque de 40 imágenes.", unit: "jornada", quantity: "3", unitPrice: "300", discountType: "NONE", discountValue: "0", taxMode: "EXCLUSIVE", taxRate: "16", hideUnitPriceInPdf: false },
      { id: randomUUID(), groupId: g1, description: "Video promocional de 60 segundos con musicalización", unit: "pieza", quantity: "2", unitPrice: "350", discountType: "NONE", discountValue: "0", taxMode: "EXCLUSIVE", taxRate: "16", hideUnitPriceInPdf: false },
    ],
    validityTerms: "Precios en dólares estadounidenses, válidos por 15 días naturales.",
    publicNotes: "Viáticos fuera del área metropolitana no incluidos.",
  });
  await changeQuoteStatus(ctxA, qa.quoteId, "SENT");
  await createQuoteVersion(ctxA, qa.quoteId);
  {
    const e = await getEditorData(ctxA, qa.quoteId);
    await saveDraft(ctxA, qa.quoteId, e.version.id, e.version.revision, {
      ...e.draft,
      publicNotes: "V2: se agrega una sesión de 1.5 horas de fotografía de retrato ejecutivo.",
      items: [...e.draft.items, { id: randomUUID(), groupId: null, description: "Sesión de retrato ejecutivo", unit: "hora", quantity: "1.5", unitPrice: "200", discountType: "NONE", discountValue: "0", taxMode: "EXCLUSIVE", taxRate: "16", hideUnitPriceInPdf: false }],
    });
  }
  await changeQuoteStatus(ctxA, qa.quoteId, "SENT");

  // Cotización B (MXN): total 10,000 MXN aprobada, anticipo 5,000 y segundo pago 3,000 => saldo 2,000.
  const qb = await createQuote(ctxA, { brandId: brandA.id, clientId: clientA.id });
  await draftFrom(ctxA, qb.quoteId, {
    title: "Cobertura fotográfica de evento corporativo",
    currency: "MXN",
    validUntil: addDays(today, 30),
    items: [{ id: randomUUID(), groupId: null, description: "Cobertura fotográfica de evento (8 horas) con entrega digital", unit: "servicio", quantity: "1", unitPrice: "10000", discountType: "NONE", discountValue: "0", taxMode: "NONE", taxRate: "0", hideUnitPriceInPdf: false }],
  });
  await changeQuoteStatus(ctxA, qb.quoteId, "SENT");
  await changeQuoteStatus(ctxA, qb.quoteId, "APPROVED");
  const now = Date.now();
  await issueReceipt(ctxA, { idempotencyKey: randomUUID(), brandId: brandA.id, quoteId: qb.quoteId, clientId: clientA.id, payerName: clientA.name, concept: "Anticipo del 50 % — cobertura de evento", paymentMethod: "TRANSFER", paymentReference: "SPEI 0001", receivedAt: new Date(now - 3 * 86400000), currency: "MXN", amount: "5000" });
  await issueReceipt(ctxA, { idempotencyKey: randomUUID(), brandId: brandA.id, quoteId: qb.quoteId, clientId: clientA.id, payerName: clientA.name, concept: "Segundo pago — cobertura de evento", paymentMethod: "TRANSFER", paymentReference: "SPEI 0002", receivedAt: new Date(now - 86400000), currency: "MXN", amount: "3000" });

  // Recibo suelto: 1,500 MXN en efectivo, sin cotización.
  await issueReceipt(ctxA, { idempotencyKey: randomUUID(), brandId: brandA.id, payerName: "Carlos Pérez (mostrador)", concept: "Impresión de fotografías", paymentMethod: "CASH", receivedAt: new Date(), currency: "MXN", amount: "1500" });

  // ---------------- Organización B (independiente) ----------------
  const orgB = await createOrganization(b.id, { name: "Consultoría Horizonte Demo" });
  const ctxB = await assertOrganizationMember(b.id, orgB.id);
  const brandB = await createBrand(ctxB, { name: "Horizonte Consultores", colorPrimary: "#3B2F8F", quotePrefix: "HZ", receiptPrefix: "HZR", pdfTemplate: "CORPORATE", defaultCurrency: "MXN" });
  const clientB = await createClient(ctxB, { name: "Grupo Altiplano Demo", email: "contacto@altiplano.local" });
  const qc = await createQuote(ctxB, { brandId: brandB.id, clientId: clientB.id });
  await draftFrom(ctxB, qc.quoteId, {
    title: "Diagnóstico organizacional",
    items: [{ id: randomUUID(), groupId: null, description: "Consultoría de diagnóstico", unit: "hora", quantity: "20", unitPrice: "1200", discountType: "PERCENT", discountValue: "10", taxMode: "EXCLUSIVE", taxRate: "16", hideUnitPriceInPdf: false }],
  });
  await changeQuoteStatus(ctxB, qc.quoteId, "SENT");

  const count = await db().select({ n: sql<number>`count(*)` }).from(users);
  console.log(`✔ Datos demo creados (${count[0].n} usuarios).`);
  console.log(`  Organización A: ${DEMO_A} / ${DEMO_PASSWORD}`);
  console.log(`  Organización B: ${DEMO_B} / ${DEMO_PASSWORD}`);
  console.log("  (Credenciales exclusivamente locales de desarrollo.)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
