/**
 * Vistas (lo que viaja al navegador). Separa lo que ve el personal de sala
 * (con teléfonos) de lo que ve el cliente (solo su propia reserva).
 */
import type { ConfigRestaurante } from "./config";
import { estimarEspera, horasDeReserva, metricas, MINUTOS_LLEGADA_ANTICIPADA, nombresMesas } from "./motor";
import { aMinutos, fechaCorta, fechaLarga, sumarDias } from "./tiempo";
import type { Estado, Reserva } from "./tipos";

export type EstadoMesa = "libre" | "ocupada" | "llega_pronto" | "limpiando";

export function vistaSala(estado: Estado, cfg: ConfigRestaurante, demo: boolean) {
  const ahora = estado.reloj;
  const ahoraMin = aMinutos(ahora.hora);
  const hoy = estado.reservas.filter((r) => r.fecha === ahora.fecha);
  const delaMesa = (id: string) => hoy.filter((r) => r.mesaIds.includes(id));

  const mesas = cfg.mesas.map((m) => {
    const rs = delaMesa(m.id);
    const sentada = rs.find((r) => r.estado === "sentada");
    const pronto = rs
      .filter((r) => r.estado === "confirmada" && aMinutos(r.hora) - MINUTOS_LLEGADA_ANTICIPADA <= ahoraMin)
      .sort((a, b) => a.hora.localeCompare(b.hora))[0];
    const limpiando = rs.find((r) => r.estado === "terminada" && r.liberadaA && ahoraMin < aMinutos(r.liberadaA) + cfg.limpiezaMin);
    const proxima = rs
      .filter((r) => r.estado === "confirmada" && r !== pronto)
      .sort((a, b) => a.hora.localeCompare(b.hora))[0];
    let estadoMesa: EstadoMesa = "libre";
    let detalle = "Libre";
    let reserva: Reserva | undefined;
    if (sentada) {
      estadoMesa = "ocupada";
      reserva = sentada;
      detalle = `${sentada.nombre} · ${sentada.personas} · desde ${sentada.sentadaA}`;
    } else if (pronto) {
      estadoMesa = "llega_pronto";
      reserva = pronto;
      detalle = `${pronto.nombre} · ${pronto.personas} · ${pronto.hora}`;
    } else if (limpiando) {
      estadoMesa = "limpiando";
      detalle = "Limpiando y montando";
    }
    return {
      id: m.id,
      nombre: m.nombre,
      capacidad: m.capacidad,
      zona: m.zona,
      forma: m.forma,
      x: m.x,
      y: m.y,
      estado: estadoMesa,
      detalle,
      reservaId: reserva?.id,
      proxima: proxima ? `${proxima.hora} · ${proxima.personas}` : undefined,
    };
  });

  const estimaciones = estimarEspera(estado, cfg, ahora);
  return {
    demo,
    restaurante: { nombre: cfg.nombre, lema: cfg.lema, ciudad: cfg.ciudad },
    reloj: ahora,
    fechaTexto: fechaLarga(ahora.fecha),
    mesas,
    reservasHoy: hoy
      .filter((r) => r.origen !== "sin_reserva" || r.estado === "sentada")
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((r) => ({
        id: r.id,
        nombre: r.nombre,
        telefono: r.telefono,
        personas: r.personas,
        hora: r.hora,
        mesas: nombresMesas(cfg, r.mesaIds),
        estado: r.estado,
        origen: r.origen,
        notas: r.notas,
      })),
    espera: estado.espera
      .filter((e) => e.estado === "esperando" && e.fecha === ahora.fecha)
      .map((e) => ({ id: e.id, nombre: e.nombre, personas: e.personas, llegada: e.llegada, estimacionMin: estimaciones.get(e.id) ?? null })),
    eventos: estado.eventos.slice(0, 25),
    metricas: metricas(estado, cfg, ahora),
    ultimoCambio: estado.ultimoCambio ?? null,
  };
}

export type VistaSala = ReturnType<typeof vistaSala>;

/** Días que se ofrecen en el selector de la reserva en línea (los cerrados salen marcados). */
export function diasReservables(estado: Estado, cfg: ConfigRestaurante, cuantos = 14) {
  return Array.from({ length: cuantos }, (_, i) => {
    const fecha = sumarDias(estado.reloj.fecha, i);
    return { fecha, texto: i === 0 ? "Hoy" : i === 1 ? "Mañana" : fechaCorta(fecha), abierto: horasDeReserva(cfg, fecha).length > 0 };
  });
}

/** Lo único que ve un cliente de su reserva: sin teléfono ni datos de otros. */
export function vistaReservaCliente(r: Reserva, cfg: ConfigRestaurante) {
  return {
    codigo: r.codigo,
    nombre: r.nombre,
    personas: r.personas,
    fecha: r.fecha,
    fechaTexto: fechaLarga(r.fecha),
    hora: r.hora,
    estado: r.estado,
    restaurante: cfg.nombre,
    toleranciaMin: cfg.toleranciaMin,
  };
}

export type VistaReservaCliente = ReturnType<typeof vistaReservaCliente>;
