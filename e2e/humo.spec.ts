import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, request }) => {
  await request.post("/api/sala", { data: { accion: "reiniciar" } });
  const errores: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  page.on("pageerror", (e) => errores.push(e.message));
  (page as unknown as { errores: string[] }).errores = errores;
});

test.afterEach(async ({ page }) => {
  expect((page as unknown as { errores: string[] }).errores).toEqual([]);
});

test("la portada carga con CSP y el plano completo", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+'/);
  await expect(page.getByRole("heading", { level: 1, name: "La Ceiba" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Mesa \S+/ })).toHaveCount(12);
});

test("al tocar una mesa que llega pronto se puede sentar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Mesa 4\b/ }).click();
  await page.getByRole("button", { name: "Ya llegaron, sentar" }).click();
  await expect(page.getByRole("button", { name: "Pagaron, liberar mesa" })).toBeVisible();
});

test("el cliente reserva desde el teléfono", async ({ page }) => {
  await page.goto("/");
  const telefono = page.getByRole("region", { name: "Reserva en línea" });
  await telefono.getByRole("button", { name: "21:15" }).click();
  await telefono.getByLabel("Nombre").fill("Prueba de humo");
  await telefono.getByLabel("Teléfono (WhatsApp)").fill("+52 55 1234 5678");
  await telefono.getByRole("button", { name: "Reservar a las 21:15" }).click();
  await expect(telefono.getByRole("heading", { name: /Te esperamos/ })).toBeVisible();
});

test("en móvil no hay desbordamiento horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("el modo presentación arranca, muestra subtítulos y se puede salir", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Ver la demo/ }).click();
  const barra = page.getByRole("region", { name: "Modo presentación" });
  await expect(barra).toContainText("Así ve tu personal el salón");
  await expect(barra).toContainText("Tu cliente reserva desde el teléfono", { timeout: 12_000 });
  await barra.getByRole("button", { name: "Salir" }).click();
  await expect(barra).toBeHidden();
});
