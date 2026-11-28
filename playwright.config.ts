import { defineConfig, devices } from "@playwright/test";

/** Test de humo: arranca la app compilada en modo demo y recorre lo esencial en un navegador real. */
const PUERTO = 3200;

export default defineConfig({
  testDir: "e2e",
  workers: 1, // la demo guarda el estado en memoria del servidor: un test cada vez
  reporter: "list",
  use: { baseURL: `http://localhost:${PUERTO}`, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: `npm run build && npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
