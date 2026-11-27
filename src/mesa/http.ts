/** Ayudas para las rutas API: errores sin filtrar detalles internos y límite de peticiones. */
import { ErrorReserva } from "./motor";
import { ipDe, limitar } from "./seguridad";

export function respuestaError(e: unknown): Response {
  if (e instanceof ErrorReserva) return Response.json({ error: e.message }, { status: 400 });
  console.error(e);
  return Response.json({ error: "Algo salió mal. Inténtalo de nuevo." }, { status: 500 });
}

/** Devuelve una respuesta 429 si se pasa del límite, o null si puede seguir. */
export function excedeLimite(req: Request, ruta: string, max: number, ventanaMs = 60_000): Response | null {
  if (limitar(`${ruta}:${ipDe(req)}`, max, ventanaMs)) return null;
  return Response.json({ error: "Demasiadas peticiones. Espera un minuto." }, { status: 429 });
}
