"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DURACION_GUION, type Momento, momentosPendientes, subtituloEn } from "@/mesa/guion";

/** Orden que el modo presentación manda a la interfaz; `n` cambia en cada disparo. */
export type OrdenGuion = { n: number; momento: Momento };

/**
 * Recorre el guion de 60 s con un reloj real y dispara cada momento una sola vez.
 * La lógica del guion (qué pasa y cuándo) vive en `src/mesa/guion.ts`.
 */
export function usePresentacion(alMomento: (m: Momento) => void) {
  const [activo, setActivo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const inicio = useRef(0);
  const disparados = useRef(0);
  const callback = useRef(alMomento);
  callback.current = alMomento;

  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => {
      const s = (performance.now() - inicio.current) / 1000;
      const r = momentosPendientes(s, disparados.current);
      disparados.current = r.disparados;
      r.nuevos.forEach((m) => callback.current(m));
      setSegundos(Math.min(s, DURACION_GUION));
    }, 200);
    return () => clearInterval(t);
  }, [activo]);

  const empezar = useCallback(() => {
    inicio.current = performance.now();
    disparados.current = 0;
    setSegundos(0);
    setActivo(true);
  }, []);
  const detener = useCallback(() => setActivo(false), []);

  return { activo, segundos, terminado: segundos >= DURACION_GUION, empezar, detener };
}

function mmss(s: number) {
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** Subtítulos grandes (pensados para grabar el vídeo), progreso y controles. */
export function BarraPresentacion({
  segundos,
  terminado,
  alRepetir,
  alReiniciar,
  alCerrar,
}: {
  segundos: number;
  terminado: boolean;
  alRepetir: () => void;
  alReiniciar: () => void;
  alCerrar: () => void;
}) {
  const sub = subtituloEn(segundos);
  return (
    <div role="region" aria-label="Modo presentación" className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-laton bg-noche/95 px-4 pb-4 pt-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1520px] flex-wrap items-center gap-x-6 gap-y-3">
        <p aria-live="polite" className="rotulo min-w-0 flex-1 basis-[28rem] text-[clamp(1.15rem,2.4vw,1.9rem)] leading-snug text-lino">
          {sub.voz}
        </p>
        <div className="flex items-center gap-2">
          <span className="cifra w-20 text-right text-sm text-lino/75">{mmss(segundos)} / {mmss(DURACION_GUION)}</span>
          {terminado ? (
            <button onClick={alRepetir} className="rounded-md bg-laton px-3 py-1.5 text-sm font-bold text-tinta hover:bg-lino">Repetir</button>
          ) : null}
          <button onClick={alReiniciar} className="rounded-md border border-noche-3 px-3 py-1.5 text-sm text-lino/85 hover:border-lino/60">Reiniciar demo</button>
          <button onClick={alCerrar} className="rounded-md border border-noche-3 px-3 py-1.5 text-sm text-lino/85 hover:border-lino/60">Salir</button>
        </div>
      </div>
      <div className="mx-auto mt-3 h-1 max-w-[1520px] overflow-hidden rounded-full bg-noche-3" aria-hidden>
        <div className="h-full bg-laton" style={{ width: `${(segundos / DURACION_GUION) * 100}%` }} />
      </div>
    </div>
  );
}
