import { describe, expect, it } from "vitest";
import * as motor from "@/mesa/motor";
import { restaurante as cfg } from "@/mesa/config";
import { crearEstadoDemo, fechaDemo } from "@/mesa/semilla";
import { aMinutos } from "@/mesa/tiempo";
import type { Ahora, Estado } from "@/mesa/tipos";

const VIERNES = "2026-11-27";
const SABADO = "2026-11-28";
const LUNES = "2026-11-30";
const nuevo = () => crearEstadoDemo(cfg, VIERNES);
const vacio = (reloj: Ahora): Estado => ({ reservas: [], espera: [], eventos: [], secuencia: 0, reloj });
const datos = (extra: Partial<motor.DatosReserva> = {}): motor.DatosReserva => ({
  nombre: "Prueba",
  telefono: "+52 55 1234 5678",
  personas: 2,
  fecha: SABADO,
  hora: "20:00",
  origen: "en_linea",
  ...extra,
});

/** Ninguna mesa puede tener dos reservas activas que se pisen (con margen de limpieza). */
function sinSolapes(e: Estado) {
  for (const fecha of new Set(e.reservas.map((r) => r.fecha))) {
    const oc = motor.ocupaciones(e, e.reloj, fecha);
    for (const a of oc) for (const b of oc) {
      if (a === b || a.mesaId !== b.mesaId || a.reservaId === b.reservaId) continue;
      expect(a.inicio < b.fin + cfg.limpiezaMin && b.inicio < a.fin + cfg.limpiezaMin, `${a.reservaId} pisa ${b.reservaId} en ${a.mesaId}`).toBe(false);
    }
  }
}

describe("horarios y disponibilidad", () => {
  it("la demo arranca el viernes a las 20:00 y un lunes salta al martes (lunes cerrado)", () => {
    expect(nuevo().reloj).toEqual({ fecha: VIERNES, hora: "20:00" });
    expect(fechaDemo(cfg, LUNES)).toBe("2026-12-01");
    expect(motor.horasDeReserva(cfg, LUNES)).toHaveLength(0);
  });

  it("ofrece horas de comida y cena cada 15 minutos hasta la última reserva", () => {
    const horas = motor.horasDeReserva(cfg, SABADO).map((h) => h.hora);
    expect(horas[0]).toBe("13:00");
    expect(horas).toContain("16:00");
    expect(horas).not.toContain("16:15");
    expect(horas).toContain("22:00");
    expect(horas).not.toContain("22:15");
  });

  it("la duración depende del tamaño del grupo", () => {
    expect(motor.duracionPara(cfg, 2)).toBe(90);
    expect(motor.duracionPara(cfg, 4)).toBe(105);
    expect(motor.duracionPara(cfg, 7)).toBe(120);
  });

  it("no ofrece horas pasadas ni dentro de la antelación mínima", () => {
    const e = vacio({ fecha: VIERNES, hora: "20:00" });
    const horas = motor.disponibilidad(e, cfg, e.reloj, { fecha: VIERNES, personas: 2 }).map((h) => h.hora);
    expect(horas[0]).toBe("21:00");
    // El personal sí puede anotar una reserva para dentro de 15 minutos.
    const personal = motor.disponibilidad(e, cfg, e.reloj, { fecha: VIERNES, personas: 2, origen: "personal" });
    expect(personal[0].hora).toBe("20:15");
  });
});

describe("asignación de mesas", () => {
  it("elige la mesa más pequeña que sirve y respeta el mínimo de personas", () => {
    const e = vacio({ fecha: VIERNES, hora: "12:00" });
    expect(motor.reservar(e, cfg, e.reloj, datos({ personas: 2 })).mesaIds).toEqual(["m1"]);
    expect(motor.reservar(e, cfg, e.reloj, datos({ personas: 3 })).mesaIds).toEqual(["m3"]);
    // Una persona sola no ocupa una mesa de 4 (mínimo 2): va a una de 2.
    expect(motor.reservar(e, cfg, e.reloj, datos({ personas: 1 })).mesaIds).toEqual(["m2"]);
  });

  it("junta mesas para un grupo grande y no reserva si no hay unión libre", () => {
    const e = vacio({ fecha: VIERNES, hora: "12:00" });
    const r = motor.reservar(e, cfg, e.reloj, datos({ personas: 12, origen: "personal" }));
    expect(r.mesaIds).toEqual(["m5", "m6", "m7"]);
    // Las uniones que comparten mesas con la anterior ya no sirven; quedan m3+m4 y t1+t2.
    expect(motor.reservar(e, cfg, e.reloj, datos({ personas: 8, hora: "20:15", origen: "personal" })).mesaIds).toEqual(["m3", "m4"]);
    expect(motor.reservar(e, cfg, e.reloj, datos({ personas: 8, hora: "20:30", origen: "personal" })).mesaIds).toEqual(["t1", "t2"]);
    expect(() => motor.reservar(e, cfg, e.reloj, datos({ personas: 8, hora: "20:45", origen: "personal" }))).toThrow(/No nos quedan mesas/);
    sinSolapes(e);
  });

  it("nunca asigna la misma mesa a reservas que se pisan, contando la limpieza", () => {
    const e = vacio({ fecha: VIERNES, hora: "12:00" });
    for (let i = 0; i < 40; i++) {
      const hora = motor.horasDeReserva(cfg, SABADO)[13 + (i % 13)].hora;
      try {
        motor.reservar(e, cfg, e.reloj, datos({ personas: 1 + (i % 6), hora, nombre: `R${i}` }));
      } catch (err) {
        expect(err).toBeInstanceOf(motor.ErrorReserva);
      }
    }
    expect(e.reservas.length).toBeGreaterThan(10);
    sinSolapes(e);
  });

  it("una mesa queda libre de nuevo tras duración + limpieza", () => {
    const e = vacio({ fecha: VIERNES, hora: "12:00" });
    for (const hora of ["19:00", "19:00"]) motor.reservar(e, cfg, e.reloj, datos({ hora }));
    // m1 y m2 ocupadas de 19:00 a 20:30 (+10 de limpieza).
    expect(motor.reservar(e, cfg, e.reloj, datos({ hora: "20:30" })).mesaIds).toEqual(["m8"]);
    expect(motor.reservar(e, cfg, e.reloj, datos({ hora: "20:45" })).mesaIds).toEqual(["m1"]);
  });
});

describe("reglas de reserva en línea", () => {
  const e = vacio({ fecha: VIERNES, hora: "20:00" });
  const casos: [string, Partial<motor.DatosReserva>, RegExp][] = [
    ["grupo demasiado grande en línea", { personas: 9 }, /llámanos/],
    ["día cerrado", { fecha: LUNES }, /no aceptamos/],
    ["fuera de horario", { hora: "17:00" }, /no aceptamos/],
    ["hora pasada", { fecha: VIERNES, hora: "19:30" }, /ya pasó/],
    ["menos de una hora de antelación", { fecha: VIERNES, hora: "20:30" }, /antelación/],
    ["más allá de 30 días", { fecha: "2027-01-15" }, /30 días/],
    ["cero personas", { personas: 0 }, /cuántas personas/],
  ];
  for (const [nombre, extra, error] of casos) {
    it(`rechaza: ${nombre}`, () => {
      expect(() => motor.reservar(e, cfg, e.reloj, datos(extra))).toThrow(error);
    });
  }

  it("limita las personas que llegan en el mismo intervalo para no saturar la cocina", () => {
    const e2 = vacio({ fecha: VIERNES, hora: "12:00" });
    motor.reservar(e2, cfg, e2.reloj, datos({ personas: 6, origen: "personal" }));
    motor.reservar(e2, cfg, e2.reloj, datos({ personas: 6, origen: "personal" }));
    expect(() => motor.reservar(e2, cfg, e2.reloj, datos({ personas: 2 }))).toThrow(/muchas personas/);
    expect(motor.reservar(e2, cfg, e2.reloj, datos({ personas: 2, hora: "20:15" })).estado).toBe("confirmada");
  });

  it("el código de la reserva es impredecible", () => {
    const e2 = vacio({ fecha: VIERNES, hora: "12:00" });
    const a = motor.reservar(e2, cfg, e2.reloj, datos());
    const b = motor.reservar(e2, cfg, e2.reloj, datos());
    expect(a.codigo).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.codigo).not.toBe(b.codigo);
  });
});

describe("servicio en vivo", () => {
  it("sentar, liberar y cancelar siguen el ciclo de vida", () => {
    const e = nuevo();
    const valeria = e.reservas.find((r) => r.nombre === "Valeria Ríos")!;
    motor.sentar(e, cfg, e.reloj, valeria.id); // llega 15 min antes y su mesa está libre
    expect(valeria.estado).toBe("sentada");
    expect(() => motor.cancelar(e, cfg, e.reloj, valeria.id)).toThrow(/confirmadas/);
    motor.liberar(e, cfg, e.reloj, valeria.id);
    expect(valeria.estado).toBe("terminada");
    const rocio = e.reservas.find((r) => r.nombre === "Rocío Méndez")!;
    expect(() => motor.sentar(e, cfg, e.reloj, rocio.id)).toThrow(/demasiado pronto/);
    motor.cancelar(e, cfg, e.reloj, rocio.id);
    expect(rocio.estado).toBe("cancelada");
  });

  it("marca como 'no se presentó' pasada la tolerancia y libera la mesa", () => {
    const e = nuevo();
    const daniel = e.reservas.find((r) => r.nombre === "Daniel Ruiz")!;
    expect(motor.marcarAusencias(e, cfg, e.reloj)).toHaveLength(0); // 19:45 + 15 = 20:00, aún en tolerancia
    motor.avanzarReloj(e, cfg, 15);
    expect(daniel.estado).toBe("no_se_presento");
    expect(motor.metricas(e, cfg, e.reloj).ausencias).toBe(1);
  });

  it("guion: pareja sin reserva se sienta; grupo de 4 espera y se sienta solo cuando alguien no llega", () => {
    const e = nuevo();
    const pareja = motor.llegaSinReserva(e, cfg, e.reloj, { nombre: "Pareja", personas: 2 });
    expect(pareja.tipo).toBe("sentado");
    if (pareja.tipo === "sentado") expect(pareja.reserva.mesaIds).toEqual(["m2"]);

    const grupo = motor.llegaSinReserva(e, cfg, e.reloj, { nombre: "Los Romero", personas: 4 });
    expect(grupo.tipo).toBe("espera");
    if (grupo.tipo !== "espera") return;
    expect(grupo.estimacionMin).toBeGreaterThan(15);

    motor.avanzarReloj(e, cfg, 15); // Daniel Ruiz (19:45, mesa 4) no llegó
    expect(grupo.item.estado).toBe("sentado");
    const sentada = motor.reservaPorId(e, grupo.item.reservaId!);
    expect(sentada.mesaIds).toEqual(["m4"]);
    expect(e.ultimoCambio?.mesaIds).toEqual(["m4"]);
    expect(motor.metricas(e, cfg, e.reloj).rescatadosDeEspera).toBe(1);
    sinSolapes(e);
  });

  it("la estimación de espera respeta el orden de la cola", () => {
    const e = nuevo();
    const a = motor.llegaSinReserva(e, cfg, e.reloj, { nombre: "A", personas: 4 });
    const b = motor.llegaSinReserva(e, cfg, e.reloj, { nombre: "B", personas: 4 });
    expect(a.tipo).toBe("espera");
    expect(b.tipo).toBe("espera");
    const est = motor.estimarEspera(e, cfg, e.reloj);
    const ea = est.get(a.tipo === "espera" ? a.item.id : "")!;
    const eb = est.get(b.tipo === "espera" ? b.item.id : "")!;
    expect(ea).not.toBeNull();
    expect(eb).toBeGreaterThanOrEqual(ea!);
    // La simulación no toca el estado real.
    expect(e.reservas.some((r) => r.id.startsWith("sim_"))).toBe(false);
  });

  it("al liberar una mesa, tras la limpieza, la lista de espera se atiende sola", () => {
    const e = nuevo();
    const g = motor.llegaSinReserva(e, cfg, e.reloj, { nombre: "Trío", personas: 3 });
    expect(g.tipo).toBe("espera");
    // Equipo Norte (6, terraza T3) pide la cuenta.
    const norte = e.reservas.find((r) => r.nombre === "Equipo Norte")!;
    motor.liberar(e, cfg, e.reloj, norte.id);
    if (g.tipo !== "espera") return;
    // Primero se limpia y se monta la mesa (10 min).
    expect(g.item.estado).toBe("esperando");
    expect(motor.estimarEspera(e, cfg, e.reloj).get(g.item.id)).toBe(10);
    motor.avanzarReloj(e, cfg, 10);
    expect(g.item.estado).toBe("sentado");
  });

  it("una mesa sentada sigue ocupada aunque se pase de su duración", () => {
    const e = nuevo();
    const ortega = e.reservas.find((r) => r.nombre === "Familia Ortega")!;
    e.reloj = { fecha: VIERNES, hora: "21:50" };
    const oc = motor.ocupaciones(e, e.reloj, VIERNES).find((o) => o.reservaId === ortega.id)!;
    expect(oc.fin).toBeGreaterThan(aMinutos("21:50"));
  });

  it("no sienta a nadie sin reserva con la cocina cerrada", () => {
    const e = vacio({ fecha: VIERNES, hora: "18:00" });
    expect(() => motor.llegaSinReserva(e, cfg, e.reloj, { nombre: "X", personas: 2 })).toThrow(/cerrada/);
  });

  it("los datos de la demo no tienen solapes", () => {
    sinSolapes(nuevo());
  });
});
