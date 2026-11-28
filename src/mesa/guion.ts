/**
 * Guion del modo presentación: los 60 segundos de PROSPECCION.md, ejecutables.
 * Puro y testeable: la interfaz solo lo recorre con un reloj y dispara cada momento una vez.
 */

export type VistaGuion = "sala" | "cliente";

export type Subtitulo = { inicio: number; fin: number; voz: string; vista: VistaGuion };

export type Momento =
  | { t: number; tipo: "reiniciar" }
  | { t: number; tipo: "rellenar_reserva" }
  | { t: number; tipo: "enviar_reserva" }
  | { t: number; tipo: "sin_reserva"; nombre: string; personas: number }
  | { t: number; tipo: "avanzar_reloj"; minutos: number }
  | { t: number; tipo: "enfocar_mesa"; mesaId: string }
  | { t: number; tipo: "resaltar_metricas" };

export const DURACION_GUION = 60;

/** La reserva que hace "el cliente" en el teléfono (datos ficticios). */
export const RESERVA_GUION = { personas: 2, hora: "21:15", nombre: "Mariana López", telefono: "+52 55 1000 3001" };

export const SUBTITULOS: Subtitulo[] = [
  { inicio: 0, fin: 8, vista: "sala", voz: "Hoy en la noche. Así ve tu personal el salón en tiempo real." },
  { inicio: 8, fin: 22, vista: "cliente", voz: "Tu cliente reserva desde el teléfono. Solo ve horas con mesa libre de verdad." },
  { inicio: 22, fin: 30, vista: "sala", voz: "La mesa se asigna sola: nunca dos reservas en la misma mesa." },
  { inicio: 30, fin: 40, vista: "sala", voz: "Llega un grupo sin reserva. En lugar de 'no sé', les das un tiempo de espera." },
  { inicio: 40, fin: 52, vista: "sala", voz: "Alguien no llegó. A los 15 minutos el sistema libera su mesa y sienta al grupo." },
  { inicio: 52, fin: 60, vista: "sala", voz: "Ninguna mesa vacía por una reserva que no llega. ¿Lo probamos en tu restaurante?" },
];

export const MOMENTOS: Momento[] = [
  { t: 0, tipo: "reiniciar" },
  { t: 9, tipo: "rellenar_reserva" },
  { t: 17, tipo: "enviar_reserva" },
  { t: 32, tipo: "sin_reserva", nombre: "Grupo de Carla", personas: 4 },
  { t: 42, tipo: "avanzar_reloj", minutos: 15 },
  { t: 44, tipo: "enfocar_mesa", mesaId: "m4" },
  { t: 52, tipo: "resaltar_metricas" },
];

/** Subtítulo que toca en el segundo `s` (el último se mantiene al terminar). */
export function subtituloEn(s: number): Subtitulo {
  return SUBTITULOS.find((x) => s >= x.inicio && s < x.fin) ?? SUBTITULOS[SUBTITULOS.length - 1];
}

/** Momentos que ya deberían haber ocurrido en el segundo `s` y aún no se han disparado. */
export function momentosPendientes(s: number, yaDisparados: number): { nuevos: Momento[]; disparados: number } {
  let n = yaDisparados;
  const nuevos: Momento[] = [];
  while (n < MOMENTOS.length && MOMENTOS[n].t <= s) nuevos.push(MOMENTOS[n++]);
  return { nuevos, disparados: n };
}
