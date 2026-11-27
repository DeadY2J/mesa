/**
 * Seguridad compartida por las rutas API.
 *  - modoDemo(): sin MESA_TOKEN todo es demo (reloj simulado, panel abierto, reinicio).
 *  - accesoPersonal(): con MESA_TOKEN, el panel de sala exige esa clave (cabecera x-mesa-clave).
 *  - limitar(): límite de peticiones por clave (IP) en ventana deslizante, en memoria.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export function modoDemo(): boolean {
  return !process.env.MESA_TOKEN;
}

function resumen(valor: string): Buffer {
  return createHash("sha256").update(valor).digest();
}

/** Comparación en tiempo constante (sobre el hash, así las longitudes coinciden). */
export function claveValida(recibida: string | null | undefined, esperada: string | undefined): boolean {
  if (!esperada || !recibida) return false;
  return timingSafeEqual(resumen(recibida), resumen(esperada));
}

export function accesoPersonal(req: Request): boolean {
  if (modoDemo()) return true;
  return claveValida(req.headers.get("x-mesa-clave"), process.env.MESA_TOKEN);
}

const ventanas = new Map<string, number[]>();

/** Devuelve true si la petición cabe en el límite; false si hay que rechazarla (429). */
export function limitar(clave: string, max: number, ventanaMs: number, ahora: number = Date.now()): boolean {
  const recientes = (ventanas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (recientes.length >= max) {
    ventanas.set(clave, recientes);
    return false;
  }
  recientes.push(ahora);
  ventanas.set(clave, recientes);
  if (ventanas.size > 5000) for (const [k, v] of ventanas) if (!v.some((t) => ahora - t < ventanaMs)) ventanas.delete(k);
  return true;
}

export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function reiniciarLimites() {
  ventanas.clear();
}
