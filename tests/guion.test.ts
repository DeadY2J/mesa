import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { restaurante as cfg } from "@/mesa/config";
import * as motor from "@/mesa/motor";
import { DURACION_GUION, MOMENTOS, momentosPendientes, RESERVA_GUION, SUBTITULOS, subtituloEn } from "@/mesa/guion";
import { crearEstadoDemo } from "@/mesa/semilla";

describe("guion del modo presentación", () => {
  it("cubre los 60 segundos sin huecos ni solapes", () => {
    expect(SUBTITULOS[0].inicio).toBe(0);
    for (let i = 1; i < SUBTITULOS.length; i++) expect(SUBTITULOS[i].inicio).toBe(SUBTITULOS[i - 1].fin);
    expect(SUBTITULOS.at(-1)!.fin).toBe(DURACION_GUION);
  });

  it("dice exactamente lo que pone el guion de PROSPECCION.md", () => {
    const doc = readFileSync(path.resolve(import.meta.dirname, "../PROSPECCION.md"), "utf8");
    for (const s of SUBTITULOS) expect(doc).toContain(`"${s.voz}"`);
  });

  it("dispara cada momento una sola vez y en orden", () => {
    expect(MOMENTOS.map((m) => m.t)).toEqual([...MOMENTOS.map((m) => m.t)].sort((a, b) => a - b));
    let disparados = 0;
    const vistos: string[] = [];
    for (let s = 0; s <= DURACION_GUION; s += 0.25) {
      const r = momentosPendientes(s, disparados);
      disparados = r.disparados;
      vistos.push(...r.nuevos.map((m) => m.tipo));
    }
    expect(vistos).toEqual(MOMENTOS.map((m) => m.tipo));
    expect(subtituloEn(25).inicio).toBe(22);
    expect(subtituloEn(99).fin).toBe(DURACION_GUION);
  });

  it("con los datos de la demo, el guion se cumple en el motor", () => {
    const e = crearEstadoDemo(cfg, "2026-11-27");
    const ahora = () => e.reloj;
    const r = motor.reservar(e, cfg, ahora(), { ...RESERVA_GUION, fecha: e.reloj.fecha, origen: "en_linea" });
    expect(r.mesaIds).toHaveLength(1);
    const grupo = MOMENTOS.find((m) => m.tipo === "sin_reserva")!;
    if (grupo.tipo !== "sin_reserva") throw new Error();
    const llega = motor.llegaSinReserva(e, cfg, ahora(), { nombre: grupo.nombre, personas: grupo.personas });
    expect(llega.tipo).toBe("espera");
    motor.avanzarReloj(e, cfg, 15);
    const m = motor.metricas(e, cfg, e.reloj);
    expect(m.ausencias).toBe(1);
    expect(m.rescatadosDeEspera).toBe(1);
    const sentado = e.reservas.find((x) => x.nombre === grupo.nombre);
    expect(sentado?.mesaIds).toEqual(["m4"]);
  });
});
