import { z } from "zod";
import { conEstado } from "@/mesa/almacen";
import { restaurante } from "@/mesa/config";
import { excedeLimite, respuestaError } from "@/mesa/http";
import { reservar } from "@/mesa/motor";
import { vistaReservaCliente } from "@/mesa/vista";

export const dynamic = "force-dynamic";

const NuevaReserva = z.object({
  nombre: z.string().trim().min(2).max(60),
  telefono: z.string().trim().regex(/^\+?[\d\s()-]{7,20}$/),
  personas: z.number().int().min(1).max(50),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  notas: z.string().trim().max(200).optional(),
});

/** Público: reserva en línea. Devuelve solo los datos de esta reserva y su código. */
export async function POST(req: Request) {
  const limite = excedeLimite(req, "reservas", 10);
  if (limite) return limite;
  const cuerpo = NuevaReserva.safeParse(await req.json().catch(() => null));
  if (!cuerpo.success) {
    return Response.json({ error: "Revisa los datos: nombre, teléfono, personas, fecha y hora." }, { status: 400 });
  }
  try {
    const r = conEstado((estado) => reservar(estado, restaurante, estado.reloj, { ...cuerpo.data, origen: "en_linea" }));
    return Response.json(vistaReservaCliente(r, restaurante), { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}
