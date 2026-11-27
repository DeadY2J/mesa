import { z } from "zod";
import { conEstado, leerEstado } from "@/mesa/almacen";
import { restaurante } from "@/mesa/config";
import { excedeLimite, respuestaError } from "@/mesa/http";
import { cancelar, reservaPorCodigo } from "@/mesa/motor";
import { vistaReservaCliente } from "@/mesa/vista";

export const dynamic = "force-dynamic";

const Codigo = z.uuid();
type Ctx = { params: Promise<{ codigo: string }> };

/** El cliente consulta SU reserva con el código impredecible que recibió. */
export async function GET(req: Request, { params }: Ctx) {
  const limite = excedeLimite(req, "reserva", 30);
  if (limite) return limite;
  const codigo = Codigo.safeParse((await params).codigo);
  const r = codigo.success ? reservaPorCodigo(leerEstado(), codigo.data) : undefined;
  if (!r) return Response.json({ error: "No encontramos esa reserva." }, { status: 404 });
  return Response.json(vistaReservaCliente(r, restaurante));
}

/** El cliente cancela SU reserva. */
export async function DELETE(req: Request, { params }: Ctx) {
  const limite = excedeLimite(req, "reserva", 30);
  if (limite) return limite;
  const codigo = Codigo.safeParse((await params).codigo);
  try {
    const r = conEstado((estado) => {
      const encontrada = codigo.success ? reservaPorCodigo(estado, codigo.data) : undefined;
      if (!encontrada) return undefined;
      return cancelar(estado, restaurante, estado.reloj, encontrada.id);
    });
    if (!r) return Response.json({ error: "No encontramos esa reserva." }, { status: 404 });
    return Response.json(vistaReservaCliente(r, restaurante));
  } catch (e) {
    return respuestaError(e);
  }
}
