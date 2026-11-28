/**
 * Datos ficticios de la demo: viernes (o el próximo día con cena) a las 20:00,
 * con el salón casi lleno. Preparado para el guion del vídeo:
 *  - Llega una pareja sin reserva → se sienta al momento (mesa 2).
 *  - Llega un grupo de 4 → lista de espera con tiempo estimado.
 *  - +15 min → Daniel Ruiz no llegó a las 19:45 → mesa 4 libre → el grupo se sienta solo.
 */
import type { ConfigRestaurante } from "./config";
import { sumarDias } from "./tiempo";
import { duracionPara, servicioAbierto } from "./motor";
import type { Ahora, Estado, Reserva } from "./tipos";

export const HORA_DEMO = "20:00";

/** Primer día desde hoy en el que el restaurante está abierto a la hora de la demo. */
export function fechaDemo(cfg: ConfigRestaurante, hoy: string): string {
  for (let i = 0; i < 7; i++) {
    const fecha = sumarDias(hoy, i);
    if (servicioAbierto(cfg, { fecha, hora: HORA_DEMO })) return fecha;
  }
  return hoy;
}

type Fila = [nombre: string, personas: number, hora: string, mesas: string[], estado: Reserva["estado"], sentadaA?: string, notas?: string];

export function crearEstadoDemo(cfg: ConfigRestaurante, hoyReal: string): Estado {
  const fecha = fechaDemo(cfg, hoyReal);
  const manana = fechaDemo(cfg, sumarDias(fecha, 1));
  const reloj: Ahora = { fecha, hora: HORA_DEMO };
  const estado: Estado = { reservas: [], espera: [], eventos: [], secuencia: 0, reloj };

  const hoy: Fila[] = [
    ["Familia Ortega", 4, "19:00", ["m3"], "sentada", "19:05"],
    ["Equipo Norte", 6, "19:00", ["t3"], "sentada", "19:00"],
    ["Ana y Luis", 2, "19:15", ["m1"], "sentada", "19:20", "Aniversario"],
    ["Cumpleaños de Paola", 7, "19:30", ["m5", "m6"], "sentada", "19:35", "Llevan pastel"],
    ["Marcos Peña", 2, "19:30", ["m8"], "sentada", "19:30"],
    ["Sofía Herrera", 4, "19:45", ["t1"], "sentada", "19:50"],
    ["Daniel Ruiz", 4, "19:45", ["m4"], "confirmada"],
    ["Valeria Ríos", 4, "20:15", ["t2"], "confirmada"],
    ["Familia Jiménez", 6, "20:30", ["m7"], "confirmada", undefined, "Una silla para bebé"],
    ["Camila Soto", 2, "21:00", ["m9"], "confirmada"],
    ["Andrés Torres", 4, "21:45", ["t1"], "confirmada"],
    ["Rocío Méndez", 3, "22:00", ["m3"], "confirmada"],
  ];
  const despues: Fila[] = [
    ["Lucía Vargas", 2, "14:00", ["m1"], "confirmada"],
    ["Grupo de la oficina", 8, "14:30", ["m5", "m6"], "confirmada"],
    ["Mateo Castro", 4, "20:30", ["m3"], "confirmada"],
  ];

  const telefonos = ["+52 55 1000 2001", "+52 55 1000 2002", "+52 55 1000 2003", "+52 55 1000 2004"];
  const agregar = (filas: Fila[], dia: string, origen: Reserva["origen"]) => {
    for (const [nombre, personas, hora, mesaIds, est, sentadaA, notas] of filas) {
      estado.secuencia += 1;
      estado.reservas.push({
        id: `res_${estado.secuencia.toString(36)}`,
        codigo: crypto.randomUUID(),
        nombre,
        telefono: telefonos[estado.secuencia % telefonos.length],
        personas,
        fecha: dia,
        hora,
        duracionMin: duracionPara(cfg, personas),
        mesaIds,
        estado: est,
        origen,
        notas,
        sentadaA,
      });
    }
  };
  agregar(hoy, fecha, "en_linea");
  agregar(despues, manana, "en_linea");
  // Las de grupos grandes llegaron por teléfono y las anotó el personal.
  for (const r of estado.reservas) if (r.personas >= 6) r.origen = "personal";
  return estado;
}
