export type Zona = "salon" | "terraza" | "barra";

export type Mesa = {
  id: string;
  nombre: string;
  capacidad: number;
  /** Mínimo de personas para asignarla (evita sentar a 1 persona en una mesa de 6). */
  minimo: number;
  zona: Zona;
  forma: "redonda" | "cuadrada" | "rectangular";
  /** Posición en el plano, en celdas de una cuadrícula de 12 × 8. */
  x: number;
  y: number;
};

export type UnionMesas = { mesas: string[]; capacidad: number; minimo: number };

export type EstadoReserva = "confirmada" | "sentada" | "terminada" | "cancelada" | "no_se_presento";
export type OrigenReserva = "en_linea" | "personal" | "sin_reserva";

export type Reserva = {
  id: string;
  /** Código impredecible que recibe el cliente para consultar o cancelar SU reserva. */
  codigo: string;
  nombre: string;
  telefono: string;
  personas: number;
  fecha: string;
  hora: string;
  duracionMin: number;
  mesaIds: string[];
  estado: EstadoReserva;
  origen: OrigenReserva;
  notas?: string;
  /** Hora real a la que se sentó / se liberó la mesa. */
  sentadaA?: string;
  liberadaA?: string;
};

export type EnEspera = {
  id: string;
  nombre: string;
  personas: number;
  llegada: string;
  fecha: string;
  estado: "esperando" | "sentado" | "se_fue";
  reservaId?: string;
};

export type TipoEvento =
  | "reserva_creada"
  | "reserva_cancelada"
  | "sentada"
  | "mesa_liberada"
  | "no_se_presento"
  | "en_espera"
  | "espera_sentada";

export type Evento = { id: string; hora: string; tipo: TipoEvento; texto: string; mesaIds?: string[] };

export type Ahora = { fecha: string; hora: string };

export type Estado = {
  reservas: Reserva[];
  espera: EnEspera[];
  eventos: Evento[];
  secuencia: number;
  /** Reloj del restaurante. En modo demo es simulado (se avanza con +15 min). */
  reloj: Ahora;
  /** Última mesa tocada, para resaltarla en el plano. */
  ultimoCambio?: { mesaIds: string[]; tipo: TipoEvento; n: number };
};
