/**
 * Utilidades de fecha. Todas las fechas de la agenda son strings en la zona
 * horaria del negocio: fecha "YYYY-MM-DD" y hora "HH:mm". Así evitamos los
 * líos de husos horarios entre el servidor (UTC), el negocio (Ciudad de México)
 * y quien prueba la demo (España).
 */

import type { Ahora } from "./tipos";
export type { Ahora };

export function ahoraEn(zonaHoraria: string, d: Date = new Date()): Ahora {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  return { fecha: `${p("year")}-${p("month")}-${p("day")}`, hora: `${p("hour")}:${p("minute")}` };
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diaSemana(fecha: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function nombreDia(fecha: string): string {
  return DIAS[diaSemana(fecha)];
}

/** "jueves 27 de noviembre" */
export function fechaLarga(fecha: string): string {
  const [, m, d] = fecha.split("-").map(Number);
  return `${nombreDia(fecha)} ${d} de ${MESES[m - 1]}`;
}

/** "jue 27" */
export function fechaCorta(fecha: string): string {
  const [, , d] = fecha.split("-").map(Number);
  return `${nombreDia(fecha).slice(0, 3)} ${d}`;
}

/** Suma minutos a una hora del mismo día. Devuelve null si se pasa de las 23:59. */
export function sumarMinutos(hora: string, minutos: number): string | null {
  const m = aMinutos(hora) + minutos;
  return m < 0 || m >= 24 * 60 ? null : aHora(m);
}
