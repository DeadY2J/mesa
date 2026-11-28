import { describe, expect, it } from "vitest";
import { restaurante as cfg } from "@/mesa/config";
import { crearEstadoDemo } from "@/mesa/semilla";
import { sillasEnMesa, vistaSala } from "@/mesa/vista";

describe("sillas del plano", () => {
  it("reparte un grupo entre mesas unidas en orden", () => {
    const r = { personas: 7, mesaIds: ["m5", "m6"] } as Parameters<typeof sillasEnMesa>[0];
    expect(sillasEnMesa(r, "m5", cfg)).toBe(4);
    expect(sillasEnMesa(r, "m6", cfg)).toBe(3);
    expect(sillasEnMesa(r, "m1", cfg)).toBe(0);
  });

  it("la vista marca las sillas ocupadas y deja a cero las libres", () => {
    const v = vistaSala(crearEstadoDemo(cfg, "2026-11-27"), cfg, true);
    const m1 = v.mesas.find((m) => m.id === "m1")!;
    const m2 = v.mesas.find((m) => m.id === "m2")!;
    expect(m1.estado).toBe("ocupada");
    expect(m1.sillasOcupadas).toBe(2);
    expect(m2.estado).toBe("libre");
    expect(m2.sillasOcupadas).toBe(0);
  });
});
