import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const unique = Date.now().toString(36);
const email = `e2e-${unique}@cotizador.local`;
const password = "PruebaE2E-2026";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "sin scroll horizontal").toBeLessThanOrEqual(1);
}

async function waitSaved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: /^Guardado$/ })).toBeVisible({ timeout: 20_000 });
}

test("vertical slice: registro → empresa → marca → cliente → cotización → PDF → recibo → saldo", async ({ page, request }) => {
  // Registro
  await page.goto("/");
  await page.getByRole("link", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre").fill("Prueba E2E");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // Onboarding (2 pasos + inicio)
  await page.waitForURL("**/bienvenida");
  await page.getByLabel("Nombre de la empresa u organización").fill(`Estudio E2E ${unique}`);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nombre comercial").fill("Marca E2E");
  await page.getByLabel("Color principal", { exact: true }).fill("#7A1F5C");
  await page.getByRole("button", { name: "Terminar" }).click();
  await page.waitForURL("**/inicio?bienvenida=1");
  await expect(page.getByText("¡Tu empresa está lista!")).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Logo de la marca
  await page.goto("/ajustes/marcas");
  await page.getByRole("link", { name: /Marca E2E/ }).click();
  await page.getByLabel("Seleccionar archivo de logo").setInputFiles(path.join(process.cwd(), "public/icons/icon-512.png"));
  await expect(page.getByText("Logo actualizado.", { exact: false })).toBeVisible();
  await expect(page.getByAltText("Logo actual")).toBeVisible();

  // Cliente
  await page.goto("/clientes/nuevo");
  await page.getByLabel("Nombre visible").fill("Cliente E2E");
  await page.getByLabel("RFC").fill("XAXX010101000");
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page.getByText("Cliente guardado.")).toBeVisible();

  // Nueva cotización con el cliente
  await page.getByRole("link", { name: "Cotizar" }).click();
  await page.getByRole("button", { name: "Crear y agregar conceptos" }).click();
  await page.waitForURL(/\/cotizaciones\/.+\/editar/);
  const quoteUrl = page.url().replace("/editar", "");
  await page.getByLabel("Moneda").selectOption("USD");
  await page.getByLabel("Título del proyecto o servicio").fill("Campaña E2E");

  const longText = "Primer párrafo de la descripción extensa con acentos: ñandú, acción, pingüino.\n\nSegundo párrafo que debe conservarse completo en el PDF sin truncarse.";
  for (const [desc, qty, price] of [
    ["Fotografía", "3", "300"],
    ["Video", "2", "350"],
    [longText, "1.5", "200"],
  ] as const) {
    await page.getByRole("button", { name: "Agregar concepto" }).click();
    const card = page.getByRole("listitem", { name: /^Concepto \d+$/ }).last();
    await card.getByLabel(/descripción/).fill(desc);
    await card.getByLabel("Cantidad").fill(qty);
    await card.getByLabel(/Precio unitario/).fill(price);
  }
  // 900 + 700 + 300 = 1,900 + IVA 16 % = 2,204 USD
  await expect(page.getByText("$2,204.00 USD").first()).toBeVisible();
  // Cambiar IVA del tercer concepto a "Sin IVA": 1,900 + 256 = 2,156
  await page.getByRole("listitem", { name: "Concepto 3" }).getByLabel("IVA", { exact: true }).selectOption("NONE");
  await expect(page.getByText("$2,156.00 USD").first()).toBeVisible();
  // Reordenar con botones accesibles: subir el concepto 2
  await page.getByRole("button", { name: "Subir concepto 2" }).click();
  await expect(page.getByRole("listitem", { name: "Concepto 1" }).getByLabel(/descripción/)).toHaveValue("Video");
  await waitSaved(page);
  await expectNoHorizontalScroll(page);

  // Recargar: nada se pierde
  await page.reload();
  await expect(page.getByRole("listitem", { name: "Concepto 1" }).getByLabel(/descripción/)).toHaveValue("Video");
  await expect(page.getByRole("listitem", { name: "Concepto 3" }).getByLabel(/descripción/)).toHaveValue(longText);
  await expect(page.getByText("$2,156.00 USD").first()).toBeVisible();

  // Enviar (asigna folio)
  await page.getByRole("button", { name: "Marcar como enviada" }).click();
  await page.waitForURL(/enviada=1/);
  await expect(page.getByText("Cotización enviada")).toBeVisible();
  const folio = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  expect(folio).toMatch(/^[A-Z0-9-]+-\d{4}-\d{4}$/);

  // PDF real con folio, cliente, moneda y total
  const quoteId = quoteUrl.split("/").pop()!;
  const pdf = await page.request.get(`/api/quotes/${quoteId}/pdf?v=1&descargar=1`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain(`Cotizacion_${folio}_Cliente_E2E_v1.pdf`);
  expect(pdf.headers()["cache-control"]).toContain("no-store");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Aprobar
  await page.getByRole("button", { name: "Marcar aprobada" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Marcar aprobada" }).click();
  await expect(page.getByText("Aprobada").first()).toBeVisible();

  // Nueva versión conserva la V1
  await page.getByRole("button", { name: "Nueva versión" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Crear versión" }).click();
  await page.waitForURL(/\/editar$/);
  await expect(page.getByText(/Versión 2 · Borrador/)).toBeVisible();
  await page.goto(`${quoteUrl}?v=1`);
  await expect(page.getByText("Estás viendo una versión anterior")).toBeVisible();

  // Recibo de anticipo desde la cotización (saldo sobre V1 aprobada)
  await page.goto(quoteUrl);
  await page.getByRole("link", { name: "Registrar pago / Emitir recibo" }).click();
  await page.getByLabel(/Monto recibido/).fill("1000");
  await page.getByRole("button", { name: "Emitir recibo" }).click();
  await page.waitForURL(/\/recibos\/.+\?emitido=1/);
  await expect(page.getByText("Recibo emitido")).toBeVisible();
  const receiptUrl = page.url().split("?")[0];

  // Saldo: 2,156 − 1,000 = 1,156
  await page.goto(quoteUrl);
  await expect(page.getByText("$1,156.00 USD")).toBeVisible();
  await expect(page.getByText("Parcialmente pagada")).toBeVisible();

  // Anular y verificar saldo restaurado
  await page.goto(receiptUrl);
  await page.getByRole("button", { name: "Anular" }).click();
  await page.getByLabel("Motivo de la anulación").fill("Captura con error");
  await page.getByRole("dialog").getByRole("button", { name: "Anular recibo" }).click();
  await expect(page.getByText("Recibo anulado")).toBeVisible();
  await page.goto(quoteUrl);
  await expect(page.getByText("Saldo pendiente").locator("..")).toContainText("$2,156.00 USD");

  // Recibo independiente
  await page.goto("/recibos/nuevo");
  await page.getByLabel("Recibimos de").fill("Pagador suelto");
  await page.getByLabel("Concepto del pago").fill("Venta de mostrador");
  await page.getByLabel("Método").selectOption("CASH");
  await page.getByLabel(/Monto recibido/).fill("1500");
  await page.getByRole("button", { name: "Emitir recibo" }).click();
  await page.waitForURL(/emitido=1/);
  const rid = page.url().split("/recibos/")[1].split("?")[0];
  const rpdf = await page.request.get(`/api/receipts/${rid}/pdf`);
  expect(rpdf.status()).toBe(200);

  // Búsqueda en historial
  await page.goto(`/cotizaciones?q=${encodeURIComponent("Campaña E2E")}`);
  await expect(page.getByText(folio)).toBeVisible();
  await page.goto(`/recibos?q=${encodeURIComponent("Pagador suelto")}`);
  await expect(page.getByText("Pagador suelto")).toBeVisible();

  // Manifest PWA válido
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const m = await manifest.json();
  expect(m.display).toBe("standalone");
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));

  // Aislamiento: otra cuenta (seed demo B) no puede ver la cotización ni el PDF
  await page.context().clearCookies();
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico").fill("demo-b@cotizador.local");
  await page.getByLabel("Contraseña").fill("DemoLocal-2026");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL("**/inicio");
  // La página responde con la vista "No encontrado" (con streaming el código HTTP puede ser 200) y no filtra datos.
  await page.goto(quoteUrl);
  await expect(page.getByRole("heading", { name: "No encontrado" })).toBeVisible();
  await expect(page.getByText(folio)).toHaveCount(0);
  await expect(page.getByText("Cliente E2E")).toHaveCount(0);
  expect((await page.request.get(`/api/quotes/${quoteId}/pdf`)).status()).toBe(404);
  expect((await page.request.get(`/api/receipts/${rid}/pdf`)).status()).toBe(404);

  // Sesión cerrada: sin acceso a PDF privados
  await page.context().clearCookies();
  expect((await page.request.get(`/api/quotes/${quoteId}/pdf`)).status()).toBe(401);
});
