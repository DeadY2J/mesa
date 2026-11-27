/**
 * Motor de reservas y mesas: reglas de negocio puras sobre el Estado.
 * No sabe nada de HTTP, interfaz ni base de datos: se testea entero y se
 * reutiliza para cualquier restaurante cambiando solo `config.ts`.
 */
import type { ConfigRestaurante, Servicio } from "./config";
import { aHora, aMinutos, diaSemana, sumarDias } from "./tiempo";
import type { Ahora, EnEspera, Estado, Evento, Reserva, TipoEvento } from "./tipos";

/** Error de regla de negocio: el mensaje se puede mostrar tal cual al usuario. */
export class ErrorReserva extends Error {}

/** Margen antes de la hora reservada en el que se puede sentar a quien llega temprano. */
export const MINUTOS_LLEGADA_ANTICIPADA = 30;
/** Hasta dónde se simula la cola para estimar la espera. */
export const HORIZONTE_ESPERA_MIN = 180;

const ACTIVAS = new Set(["confirmada", "sentada", "terminada"]);

export function nuevoId(estado: Estado, prefijo: string): string {
  estado.secuencia += 1;
  return `${prefijo}_${estado.secuencia.toString(36)}`;
}

export function registrarEvento(estado: Estado, tipo: TipoEvento, texto: string, mesaIds?: string[]): Evento {
  const evento: Evento = { id: nuevoId(estado, "ev"), hora: estado.reloj.hora, tipo, texto, mesaIds };
  estado.eventos.unshift(evento);
  if (estado.eventos.length > 200) estado.eventos.length = 200;
  if (mesaIds?.length) estado.ultimoCambio = { mesaIds, tipo, n: estado.secuencia };
  return evento;
}

// ---------------------------------------------------------------------------
// Horarios
// ---------------------------------------------------------------------------

export function serviciosDelDia(cfg: ConfigRestaurante, fecha: string): Servicio[] {
  return cfg.horarios[diaSemana(fecha)] ?? [];
}

/** Horas a las que se puede reservar ese día, con el servicio al que pertenecen. */
export function horasDeReserva(cfg: ConfigRestaurante, fecha: string): { hora: string; servicio: string }[] {
  const horas: { hora: string; servicio: string }[] = [];
  for (const s of serviciosDelDia(cfg, fecha)) {
    for (let m = aMinutos(s.abre); m <= aMinutos(s.ultimaReserva); m += cfg.intervaloMin) {
      horas.push({ hora: aHora(m), servicio: s.nombre });
    }
  }
  return horas;
}

/** Servicio abierto a esa hora para sentar a gente sin reserva (entre apertura y cierre de cocina). */
export function servicioAbierto(cfg: ConfigRestaurante, ahora: Ahora): Servicio | undefined {
  const m = aMinutos(ahora.hora);
  return serviciosDelDia(cfg, ahora.fecha).find((s) => m >= aMinutos(s.abre) && m < aMinutos(s.cierra));
}

export function duracionPara(cfg: ConfigRestaurante, personas: number): number {
  return (cfg.duracion.find((d) => personas <= d.hasta) ?? cfg.duracion[cfg.duracion.length - 1]).minutos;
}

export function capacidadMaxima(cfg: ConfigRestaurante): number {
  return Math.max(...cfg.mesas.map((m) => m.capacidad), ...cfg.uniones.map((u) => u.capacidad));
}

// ---------------------------------------------------------------------------
// Ocupación de mesas
// ---------------------------------------------------------------------------

export type Ocupacion = { mesaId: string; reservaId: string; inicio: number; fin: number };

/**
 * Intervalos [inicio, fin) en minutos que ocupa cada reserva ese día.
 * Una mesa sentada sigue ocupada hasta que el personal la libera, aunque se pase de su duración.
 */
export function ocupaciones(estado: Estado, ahora: Ahora, fecha: string): Ocupacion[] {
  const ahoraMin = aMinutos(ahora.hora);
  const lista: Ocupacion[] = [];
  for (const r of estado.reservas) {
    if (r.fecha !== fecha || !ACTIVAS.has(r.estado)) continue;
    const hora = aMinutos(r.hora);
    const inicio = r.sentadaA ? Math.min(hora, aMinutos(r.sentadaA)) : hora;
    let fin = hora + r.duracionMin;
    if (r.estado === "terminada") fin = r.liberadaA ? aMinutos(r.liberadaA) : fin;
    if (r.estado === "sentada" && fecha === ahora.fecha) fin = Math.max(fin, ahoraMin + 1);
    for (const mesaId of r.mesaIds) lista.push({ mesaId, reservaId: r.id, inicio, fin });
  }
  return lista;
}

/** ¿Están libres estas mesas entre inicio y fin, contando el margen de limpieza a ambos lados? */
export function mesasLibres(
  cfg: ConfigRestaurante,
  ocup: Ocupacion[],
  mesaIds: string[],
  inicio: number,
  fin: number,
  excluirReservaId?: string,
): boolean {
  const L = cfg.limpiezaMin;
  return !ocup.some(
    (o) => o.reservaId !== excluirReservaId && mesaIds.includes(o.mesaId) && o.inicio < fin + L && inicio < o.fin + L,
  );
}

/**
 * Opciones de mesa para un grupo, de mejor a peor ajuste: primero mesas solas
 * (la más pequeña que sirve), después uniones. Con `relajar` acepta mesas
 * aunque el grupo no llegue al mínimo (para gente sin reserva: mejor sentarla que perderla).
 */
export function opcionesDeMesa(cfg: ConfigRestaurante, personas: number, relajar = false): string[][] {
  const sirve = (min: number, cap: number) => personas <= cap && (relajar || personas >= min);
  const solas = cfg.mesas
    .filter((m) => sirve(m.minimo, m.capacidad))
    .sort((a, b) => a.capacidad - b.capacidad)
    .map((m) => [m.id]);
  const uniones = cfg.uniones
    .filter((u) => sirve(u.minimo, u.capacidad))
    .sort((a, b) => a.capacidad - b.capacidad || a.mesas.length - b.mesas.length)
    .map((u) => u.mesas);
  return [...solas, ...uniones];
}

export function buscarMesa(
  estado: Estado,
  cfg: ConfigRestaurante,
  ahora: Ahora,
  datos: { fecha: string; inicio: number; personas: number; relajar?: boolean; excluirReservaId?: string },
): string[] | null {
  const ocup = ocupaciones(estado, ahora, datos.fecha);
  const fin = datos.inicio + duracionPara(cfg, datos.personas);
  const listas = [opcionesDeMesa(cfg, datos.personas)];
  if (datos.relajar) listas.push(opcionesDeMesa(cfg, datos.personas, true));
  for (const opciones of listas) {
    for (const mesaIds of opciones) {
      if (mesasLibres(cfg, ocup, mesaIds, datos.inicio, fin, datos.excluirReservaId)) return mesaIds;
    }
  }
  return null;
}

/** Personas que llegan con reserva a esa hora exacta (para el tope de la cocina). */
export function llegadasA(estado: Estado, fecha: string, hora: string): number {
  return estado.reservas
    .filter((r) => r.fecha === fecha && r.hora === hora && r.origen !== "sin_reserva" && ACTIVAS.has(r.estado))
    .reduce((s, r) => s + r.personas, 0);
}

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------

export type DatosReserva = {
  nombre: string;
  telefono: string;
  personas: number;
  fecha: string;
  hora: string;
  notas?: string;
  origen: "en_linea" | "personal";
};

/** Comprueba las reglas de fecha/hora/tamaño. Lanza ErrorReserva con un mensaje para el usuario. */
export function validarSolicitud(
  estado: Estado,
  cfg: ConfigRestaurante,
  ahora: Ahora,
  d: Pick<DatosReserva, "personas" | "fecha" | "hora" | "origen">,
) {
  if (!Number.isInteger(d.personas) || d.personas < 1) throw new ErrorReserva("Indica cuántas personas son.");
  if (d.origen === "en_linea" && d.personas > cfg.maxPersonasEnLinea) {
    throw new ErrorReserva(`Para grupos de más de ${cfg.maxPersonasEnLinea} personas, llámanos al ${cfg.telefono}.`);
  }
  if (d.personas > capacidadMaxima(cfg)) throw new ErrorReserva("No tenemos mesas para un grupo tan grande.");
  if (d.fecha < ahora.fecha || d.fecha > sumarDias(ahora.fecha, cfg.diasReservables)) {
    throw new ErrorReserva(`Solo aceptamos reservas para los próximos ${cfg.diasReservables} días.`);
  }
  if (!horasDeReserva(cfg, d.fecha).some((h) => h.hora === d.hora)) {
    throw new ErrorReserva("A esa hora no aceptamos reservas.");
  }
  if (d.fecha === ahora.fecha) {
    const margen = aMinutos(d.hora) - aMinutos(ahora.hora);
    if (margen <= 0) throw new ErrorReserva("Esa hora ya pasó.");
    if (d.origen === "en_linea" && margen < cfg.antelacionMinimaMin) {
      throw new ErrorReserva(`Las reservas en línea se hacen con al menos ${cfg.antelacionMinimaMin} minutos de antelación.`);
    }
  }
  if (llegadasA(estado, d.fecha, d.hora) + d.personas > cfg.maxLlegadasPorIntervalo) {
    throw new ErrorReserva("A esa hora ya llegan muchas personas. Prueba 15 minutos antes o después.");
  }
}

export type HoraDisponible = { hora: string; servicio: string };

/** Horas con mesa disponible para ese grupo y día (lo que ve el cliente al reservar). */
export function disponibilidad(
  estado: Estado,
  cfg: ConfigRestaurante,
  ahora: Ahora,
  q: { fecha: string; personas: number; origen?: DatosReserva["origen"] },
): HoraDisponible[] {
  const origen = q.origen ?? "en_linea";
  return horasDeReserva(cfg, q.fecha).filter(({ hora }) => {
    try {
      validarSolicitud(estado, cfg, ahora, { personas: q.personas, fecha: q.fecha, hora, origen });
    } catch (e) {
      if (e instanceof ErrorReserva) return false;
      throw e;
    }
    return buscarMesa(estado, cfg, ahora, { fecha: q.fecha, inicio: aMinutos(hora), personas: q.personas }) !== null;
  });
}

export function reservar(estado: Estado, cfg: ConfigRestaurante, ahora: Ahora, d: DatosReserva): Reserva {
  validarSolicitud(estado, cfg, ahora, d);
  const mesaIds = buscarMesa(estado, cfg, ahora, { fecha: d.fecha, inicio: aMinutos(d.hora), personas: d.personas });
  if (!mesaIds) throw new ErrorReserva(`No nos quedan mesas para ${d.personas} a esa hora. Prueba otra hora.`);
  const reserva: Reserva = {
    id: nuevoId(estado, "res"),
    // Impredecible: es lo único que necesita el cliente para ver o cancelar su reserva.
    codigo: crypto.randomUUID(),
    nombre: d.nombre.trim(),
    telefono: d.telefono.trim(),
    personas: d.personas,
    fecha: d.fecha,
    hora: d.hora,
    duracionMin: duracionPara(cfg, d.personas),
    mesaIds,
    estado: "confirmada",
    origen: d.origen,
    notas: d.notas?.trim() || undefined,
  };
  estado.reservas.push(reserva);
  const via = d.origen === "en_linea" ? "en línea" : "por el personal";
  registrarEvento(estado, "reserva_creada", `${reserva.nombre} reservó ${via} para ${d.personas} a las ${d.hora} (${nombresMesas(cfg, mesaIds)}).`, mesaIds);
  return reserva;
}

export function reservaPorId(estado: Estado, id: string): Reserva {
  const r = estado.reservas.find((x) => x.id === id);
  if (!r) throw new ErrorReserva("No encontramos esa reserva.");
  return r;
}

export function reservaPorCodigo(estado: Estado, codigo: string): Reserva | undefined {
  return estado.reservas.find((x) => x.codigo === codigo);
}

export function cancelar(estado: Estado, cfg: ConfigRestaurante, ahora: Ahora, id: string): Reserva {
  const r = reservaPorId(estado, id);
  if (r.estado !== "confirmada") throw new ErrorReserva("Solo se pueden cancelar reservas confirmadas que aún no llegan.");
  r.estado = "cancelada";
  registrarEvento(estado, "reserva_cancelada", `${r.nombre} canceló su reserva de las ${r.hora}.`, r.mesaIds);
  atenderEspera(estado, cfg, ahora);
  return r;
}

export function sentar(estado: Estado, cfg: ConfigRestaurante, ahora: Ahora, id: string): Reserva {
  const r = reservaPorId(estado, id);
  if (r.estado !== "confirmada") throw new ErrorReserva("Esa reserva no está pendiente de llegar.");
  if (r.fecha !== ahora.fecha) throw new ErrorReserva("Esa reserva no es para hoy.");
  const ahoraMin = aMinutos(ahora.hora);
  const horaMin = aMinutos(r.hora);
  if (ahoraMin < horaMin - MINUTOS_LLEGADA_ANTICIPADA) {
    throw new ErrorReserva(`Es demasiado pronto: se puede sentar desde ${MINUTOS_LLEGADA_ANTICIPADA} minutos antes.`);
  }
  if (ahoraMin < horaMin) {
    // Llegan antes: la mesa tiene que estar libre desde ya hasta su hora.
    const ocup = ocupaciones(estado, ahora, r.fecha);
    const libre = !ocup.some((o) => o.reservaId !== r.id && r.mesaIds.includes(o.mesaId) && o.inicio < horaMin && ahoraMin < o.fin + cfg.limpiezaMin);
    if (!libre) throw new ErrorReserva("Su mesa todavía está ocupada. Que esperen unos minutos.");
  }
  r.estado = "sentada";
  r.sentadaA = ahora.hora;
  registrarEvento(estado, "sentada", `Llegó ${r.nombre} (${r.personas}): ${nombresMesas(cfg, r.mesaIds)}.`, r.mesaIds);
  return r;
}

/** La mesa se va (cuenta pagada): queda libre y se atiende la lista de espera. */
export function liberar(estado: Estado, cfg: ConfigRestaurante, ahora: Ahora, id: string): Reserva {
  const r = reservaPorId(estado, id);
  if (r.estado !== "sentada") throw new ErrorReserva("Esa mesa no está ocupada.");
  r.estado = "terminada";
  r.liberadaA = ahora.hora;
  registrarEvento(estado, "mesa_liberada", `Se liberó ${laMesa(cfg, r.mesaIds)} (${r.nombre}).`, r.mesaIds);
  atenderEspera(estado, cfg, ahora);
  return r;
}

/** Reservas confirmadas que pasaron la tolerancia sin llegar: "no se presentó" y mesa libre. */
export function marcarAusencias(estado: Estado, cfg: ConfigRestaurante, ahora: Ahora): Reserva[] {
  const ahoraMin = aMinutos(ahora.hora);
  const ausentes = estado.reservas.filter(
    (r) =>
      r.estado === "confirmada" &&
      (r.fecha < ahora.fecha || (r.fecha === ahora.fecha && ahoraMin > aMinutos(r.hora) + cfg.toleranciaMin)),
  );
  for (const r of ausentes) {
    r.estado = "no_se_presento";
    if (r.fecha === ahora.fecha) {
      registrarEvento(estado, "no_se_presento", `${r.nombre} no llegó a su reserva de las ${r.hora}. Se libera ${laMesa(cfg, r.mesaIds)}.`, r.mesaIds);
    }
  }
  if (ausentes.length) atenderEspera(estado, cfg, ahora);
  return ausentes;
}

// ---------------------------------------------------------------------------
// Sin reserva y lista de espera
// ---------------------------------------------------------------------------

function sentarAhora(estado: Estado, cfg: ConfigRestaurante, ahora: Ahora, nombre: string, personas: number, mesaIds: string[]): Reserva {
  const r: Reserva = {
    id: nuevoId(estado, "res"),
    codigo: crypto.randomUUID(),
    nombre,
    telefono: "",
    personas,
    fecha: ahora.fecha,
    hora: ahora.hora,
    duracionMin: duracionPara(cfg, personas),
    mesaIds,
    estado: "sentada",
    origen: "sin_reserva",
    sentadaA: ahora.hora,
  };
  estado.reservas.push(r);
  return r;
}

export type ResultadoSinReserva =
  | { tipo: "sentado"; reserva: Reserva }
  | { tipo: "espera"; item: EnEspera; estimacionMin: number | null };

export function llegaSinReserva(
  estado: Estado,
  cfg: ConfigRestaurante,
  ahora: Ahora,
  d: { nombre: string; personas: number },
): ResultadoSinReserva {
  if (!servicioAbierto(cfg, ahora)) throw new ErrorReserva("Ahora la cocina está cerrada.");
  if (!Number.isInteger(d.personas) || d.personas < 1) throw new ErrorReserva("Indica cuántas personas son.");
  if (d.personas > capacidadMaxima(cfg)) throw new ErrorReserva("No tenemos mesas para un grupo tan grande.");
  const nombre = d.nombre.trim() || `Grupo de ${d.personas}`;
  const hayCola = estado.espera.some((e) => e.estado === "esperando" && e.fecha === ahora.fecha);
  const mesaIds = hayCola ? null : buscarMesa(estado, cfg, ahora, { fecha: ahora.fecha, inicio: aMinutos(ahora.hora), personas: d.personas, relajar: true });
  if (mesaIds) {
    const reserva = sentarAhora(estado, cfg, ahora, nombre, d.personas, mesaIds);
    registrarEvento(estado, "sentada", `${nombre} llegó sin reserva (${d.personas}): ${nombresMesas(cfg, mesaIds)}.`, mesaIds);
    return { tipo: "sentado", reserva };
  }
  const item: EnEspera = { id: nuevoId(estado, "esp"), nombre, personas: d.personas, llegada: ahora.hora, fecha: ahora.fecha, estado: "esperando" };
  estado.espera.push(item);
  // Si hay cola pero ya hay mesa para alguien, se atiende en orden.
  atenderEspera(estado, cfg, ahora);
  const estimacionMin = item.estado === "sentado" ? 0 : (estimarEspera(estado, cfg, ahora).get(item.id) ?? null);
  if (item.estado === "sentado") {
    return { tipo: "sentado", reserva: reservaPorId(estado, item.reservaId!) };
  }
  const txt = estimacionMin === null ? "sin estimación" : `espera estimada ${estimacionMin} min`;
  registrarEvento(estado, "en_espera", `${nombre} (${d.personas}) entra en la lista de espera: ${txt}.`);
  return { tipo: "espera", item, estimacionMin };
}

/**
 * Sienta, en orden de llegada, a quien esté esperando y ya tenga mesa.
 * Si el primero es un grupo grande sin mesa, un grupo pequeño de detrás puede pasar.
 */
export function atenderEspera(estado: Estado, cfg: ConfigRestaurante, ahora: Ahora): EnEspera[] {
  const sentados: EnEspera[] = [];
  if (!servicioAbierto(cfg, ahora)) return sentados;
  for (const e of estado.espera) {
    if (e.estado !== "esperando" || e.fecha !== ahora.fecha) continue;
    const mesaIds = buscarMesa(estado, cfg, ahora, { fecha: ahora.fecha, inicio: aMinutos(ahora.hora), personas: e.personas, relajar: true });
    if (!mesaIds) continue;
    const r = sentarAhora(estado, cfg, ahora, e.nombre, e.personas, mesaIds);
    e.estado = "sentado";
    e.reservaId = r.id;
    sentados.push(e);
    const espero = aMinutos(ahora.hora) - aMinutos(e.llegada);
    registrarEvento(estado, "espera_sentada", `${e.nombre} (${e.personas}) pasa a ${laMesa(cfg, mesaIds)} tras esperar ${espero} min.`, mesaIds);
  }
  return sentados;
}

/**
 * Minutos estimados de espera para cada grupo en cola. Simula la cola en orden:
 * cada grupo "ocupa" la primera mesa que se libere para él (según las duraciones
 * previstas y las reservas ya hechas), y el siguiente parte de ahí.
 * null = sin mesa dentro del horizonte de 3 horas.
 */
export function estimarEspera(estado: Estado, cfg: ConfigRestaurante, ahora: Ahora): Map<string, number | null> {
  const sim: Estado = structuredClone(estado);
  const res = new Map<string, number | null>();
  const ahoraMin = aMinutos(ahora.hora);
  for (const e of sim.espera) {
    if (e.estado !== "esperando" || e.fecha !== ahora.fecha) continue;
    res.set(e.id, null);
    for (let t = ahoraMin; t <= Math.min(ahoraMin + HORIZONTE_ESPERA_MIN, 24 * 60 - 1); t += 5) {
      const mesaIds = buscarMesa(sim, cfg, ahora, { fecha: ahora.fecha, inicio: t, personas: e.personas, relajar: true });
      if (!mesaIds) continue;
      res.set(e.id, t - ahoraMin);
      sim.reservas.push({
        id: `sim_${e.id}`, codigo: "", nombre: e.nombre, telefono: "", personas: e.personas, fecha: ahora.fecha,
        hora: aHora(t), duracionMin: duracionPara(cfg, e.personas), mesaIds, estado: "confirmada", origen: "sin_reserva",
      });
      break;
    }
  }
  return res;
}

export function retirarDeEspera(estado: Estado, id: string): EnEspera {
  const e = estado.espera.find((x) => x.id === id);
  if (!e || e.estado !== "esperando") throw new ErrorReserva("Ese grupo ya no está esperando.");
  e.estado = "se_fue";
  registrarEvento(estado, "en_espera", `${e.nombre} (${e.personas}) se retiró de la lista de espera.`);
  return e;
}

// ---------------------------------------------------------------------------
// Reloj (solo demo) y métricas
// ---------------------------------------------------------------------------

/** Avanza el reloj simulado: marca ausencias y atiende la lista de espera. */
export function avanzarReloj(estado: Estado, cfg: ConfigRestaurante, minutos: number): Ahora {
  const m = Math.min(aMinutos(estado.reloj.hora) + minutos, 23 * 60 + 59);
  estado.reloj = { fecha: estado.reloj.fecha, hora: aHora(m) };
  marcarAusencias(estado, cfg, estado.reloj);
  atenderEspera(estado, cfg, estado.reloj);
  return estado.reloj;
}

/** "la mesa 4" / "las mesas 5 + 6" */
export function laMesa(cfg: ConfigRestaurante, mesaIds: string[]): string {
  return `${mesaIds.length === 1 ? "la" : "las"} ${nombresMesas(cfg, mesaIds)}`;
}

export function nombresMesas(cfg: ConfigRestaurante, mesaIds: string[]): string {
  const nombres = mesaIds.map((id) => cfg.mesas.find((m) => m.id === id)?.nombre ?? id);
  return nombres.length === 1 ? `mesa ${nombres[0]}` : `mesas ${nombres.join(" + ")}`;
}

export type Metricas = {
  reservasHoy: number;
  comensalesPrevistos: number;
  sentadosAhora: number;
  ocupacionPct: number;
  ausencias: number;
  enEspera: number;
  rescatadosDeEspera: number;
};

export function metricas(estado: Estado, cfg: ConfigRestaurante, ahora: Ahora): Metricas {
  const hoy = estado.reservas.filter((r) => r.fecha === ahora.fecha);
  const conReserva = hoy.filter((r) => r.origen !== "sin_reserva");
  const sentadas = hoy.filter((r) => r.estado === "sentada");
  const plazas = cfg.mesas.reduce((s, m) => s + m.capacidad, 0);
  const sentadosAhora = sentadas.reduce((s, r) => s + r.personas, 0);
  return {
    reservasHoy: conReserva.filter((r) => r.estado !== "cancelada").length,
    comensalesPrevistos: conReserva.filter((r) => ACTIVAS.has(r.estado)).reduce((s, r) => s + r.personas, 0),
    sentadosAhora,
    ocupacionPct: Math.round((sentadosAhora / plazas) * 100),
    ausencias: hoy.filter((r) => r.estado === "no_se_presento").length,
    enEspera: estado.espera.filter((e) => e.estado === "esperando" && e.fecha === ahora.fecha).length,
    rescatadosDeEspera: estado.espera.filter((e) => e.estado === "sentado" && e.fecha === ahora.fecha).length,
  };
}
