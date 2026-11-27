/**
 * Configuración del restaurante: lo ÚNICO que cambia por cliente.
 * Mesas, uniones posibles, horarios de servicio y reglas de reserva.
 */
import type { Mesa, UnionMesas } from "./tipos";

export type Servicio = {
  nombre: string;
  abre: string;
  /** Última hora a la que se acepta una reserva. */
  ultimaReserva: string;
  /** A partir de esta hora ya no se sienta a nadie sin reserva (cierre de cocina). */
  cierra: string;
};

export type ConfigRestaurante = {
  nombre: string;
  lema: string;
  ciudad: string;
  zonaHoraria: string;
  telefono: string;
  /** Cada cuántos minutos se ofrecen horas de reserva. */
  intervaloMin: number;
  /** Minutos de cortesía antes de marcar una reserva como "no se presentó". */
  toleranciaMin: number;
  /** Minutos para limpiar y montar la mesa entre una reserva y la siguiente. */
  limpiezaMin: number;
  /** Duración estimada según el tamaño del grupo (primer tramo que cumpla "hasta"). */
  duracion: { hasta: number; minutos: number }[];
  /** Tope de personas que pueden llegar con reserva en un mismo intervalo (protege a la cocina). */
  maxLlegadasPorIntervalo: number;
  /** Grupos más grandes deben llamar: no se reservan en línea. */
  maxPersonasEnLinea: number;
  /** Antelación mínima para reservar en línea. */
  antelacionMinimaMin: number;
  /** Cuántos días hacia adelante se puede reservar. */
  diasReservables: number;
  /** Servicios por día de la semana (0 = domingo). Sin entrada = cerrado. */
  horarios: Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, Servicio[]>>;
  mesas: Mesa[];
  /** Mesas que se pueden juntar para grupos grandes. */
  uniones: UnionMesas[];
};

const comida: Servicio = { nombre: "Comida", abre: "13:00", ultimaReserva: "16:00", cierra: "17:30" };
const cena: Servicio = { nombre: "Cena", abre: "19:00", ultimaReserva: "22:00", cierra: "23:45" };

export const restaurante: ConfigRestaurante = {
  nombre: "La Ceiba",
  lema: "Cocina de mercado",
  ciudad: "Ciudad de México",
  zonaHoraria: "America/Mexico_City",
  telefono: "+52 55 0000 0000",
  intervaloMin: 15,
  toleranciaMin: 15,
  limpiezaMin: 10,
  duracion: [
    { hasta: 2, minutos: 90 },
    { hasta: 4, minutos: 105 },
    { hasta: 99, minutos: 120 },
  ],
  maxLlegadasPorIntervalo: 12,
  maxPersonasEnLinea: 8,
  antelacionMinimaMin: 60,
  diasReservables: 30,
  horarios: {
    0: [comida],
    2: [comida, cena],
    3: [comida, cena],
    4: [comida, cena],
    5: [comida, cena],
    6: [comida, cena],
  },
  mesas: [
    { id: "m1", nombre: "1", capacidad: 2, minimo: 1, zona: "salon", forma: "redonda", x: 1, y: 1 },
    { id: "m2", nombre: "2", capacidad: 2, minimo: 1, zona: "salon", forma: "redonda", x: 3, y: 1 },
    { id: "m3", nombre: "3", capacidad: 4, minimo: 2, zona: "salon", forma: "cuadrada", x: 5, y: 1 },
    { id: "m4", nombre: "4", capacidad: 4, minimo: 2, zona: "salon", forma: "cuadrada", x: 7, y: 1 },
    { id: "m5", nombre: "5", capacidad: 4, minimo: 2, zona: "salon", forma: "cuadrada", x: 1, y: 4 },
    { id: "m6", nombre: "6", capacidad: 4, minimo: 2, zona: "salon", forma: "cuadrada", x: 3, y: 4 },
    { id: "m7", nombre: "7", capacidad: 6, minimo: 4, zona: "salon", forma: "rectangular", x: 5, y: 4 },
    { id: "m8", nombre: "8", capacidad: 2, minimo: 1, zona: "barra", forma: "redonda", x: 1, y: 7 },
    { id: "m9", nombre: "9", capacidad: 2, minimo: 1, zona: "barra", forma: "redonda", x: 3, y: 7 },
    { id: "t1", nombre: "T1", capacidad: 4, minimo: 2, zona: "terraza", forma: "cuadrada", x: 10, y: 1 },
    { id: "t2", nombre: "T2", capacidad: 4, minimo: 2, zona: "terraza", forma: "cuadrada", x: 10, y: 4 },
    { id: "t3", nombre: "T3", capacidad: 6, minimo: 3, zona: "terraza", forma: "rectangular", x: 10, y: 7 },
  ],
  uniones: [
    { mesas: ["m5", "m6"], capacidad: 8, minimo: 5 },
    { mesas: ["m3", "m4"], capacidad: 8, minimo: 5 },
    { mesas: ["m5", "m6", "m7"], capacidad: 14, minimo: 9 },
    { mesas: ["t1", "t2"], capacidad: 8, minimo: 5 },
  ],
};
