import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claveValida, limitar, modoDemo, accesoPersonal, reiniciarLimites } from "@/mesa/seguridad";

describe("seguridad", () => {
  beforeEach(() => reiniciarLimites());
  afterEach(() => { delete process.env.MESA_TOKEN; });

  it("sin MESA_TOKEN es modo demo y el panel está abierto", () => {
    expect(modoDemo()).toBe(true);
    expect(accesoPersonal(new Request("http://x/api/sala"))).toBe(true);
  });

  it("con MESA_TOKEN el panel exige la clave exacta", () => {
    process.env.MESA_TOKEN = "clave-larga-de-prueba";
    expect(modoDemo()).toBe(false);
    expect(accesoPersonal(new Request("http://x/api/sala"))).toBe(false);
    expect(accesoPersonal(new Request("http://x/api/sala", { headers: { "x-mesa-clave": "otra" } }))).toBe(false);
    expect(accesoPersonal(new Request("http://x/api/sala", { headers: { "x-mesa-clave": "clave-larga-de-prueba" } }))).toBe(true);
  });

  it("una clave vacía nunca es válida", () => {
    expect(claveValida("", "")).toBe(false);
    expect(claveValida("a", undefined)).toBe(false);
  });

  it("limita las peticiones por ventana", () => {
    for (let i = 0; i < 3; i++) expect(limitar("ip", 3, 1000, 0)).toBe(true);
    expect(limitar("ip", 3, 1000, 10)).toBe(false);
    expect(limitar("ip", 3, 1000, 2000)).toBe(true);
  });
});
