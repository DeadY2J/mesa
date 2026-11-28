/**
 * Almacén en memoria para la demo (cero configuración: npm run dev y listo).
 * En producción se sustituye por Supabase/Postgres implementando las mismas
 * funciones `leerEstado` / `conEstado`; el motor no cambia.
 */
import { restaurante } from "./config";
import { atenderEspera, marcarAusencias } from "./motor";
import { modoDemo } from "./seguridad";
import { crearEstadoDemo } from "./semilla";
import { ahoraEn } from "./tiempo";
import type { Estado } from "./tipos";

const g = globalThis as unknown as { __mesaEstado?: Estado };

function horaReal() {
  return ahoraEn(restaurante.zonaHoraria);
}

export function leerEstado(): Estado {
  if (!g.__mesaEstado) g.__mesaEstado = crearEstadoDemo(restaurante, horaReal().fecha);
  // Fuera de la demo el reloj es la hora real del restaurante.
  if (!modoDemo()) g.__mesaEstado.reloj = horaReal();
  marcarAusencias(g.__mesaEstado, restaurante, g.__mesaEstado.reloj);
  atenderEspera(g.__mesaEstado, restaurante, g.__mesaEstado.reloj);
  return g.__mesaEstado;
}

/** Ejecuta una mutación sobre el estado (punto único para cambiar a una BD transaccional). */
export function conEstado<T>(fn: (estado: Estado) => T): T {
  return fn(leerEstado());
}

export function reiniciarDemo(): Estado {
  g.__mesaEstado = crearEstadoDemo(restaurante, horaReal().fecha);
  return g.__mesaEstado;
}
