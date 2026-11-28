import { z } from "zod";
import { leerEstado } from "@/mesa/almacen";
import { restaurante } from "@/mesa/config";
import { excedeLimite, respuestaError } from "@/mesa/http";
import { disponibilidad } from "@/mesa/motor";
import { diasReservables } from "@/mesa/vista";

export const dynamic = "force-dynamic";

const Consulta = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  personas: z.coerce.number().int().min(1).max(50).default(2),
});

/** Público: horas libres para un grupo. No revela quién reservó. */
export function GET(req: Request) {
  const limite = excedeLimite(req, "disponibilidad", 60);
  if (limite) return limite;
  const url = new URL(req.url);
  const q = Consulta.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return Response.json({ error: "Consulta no válida." }, { status: 400 });
  try {
    const estado = leerEstado();
    const fecha = q.data.fecha ?? estado.reloj.fecha;
    return Response.json({
      ahora: estado.reloj,
      fecha,
      dias: diasReservables(estado, restaurante),
      maxPersonas: restaurante.maxPersonasEnLinea,
      telefono: restaurante.telefono,
      horas: disponibilidad(estado, restaurante, estado.reloj, { fecha, personas: q.data.personas }),
    });
  } catch (e) {
    return respuestaError(e);
  }
}
