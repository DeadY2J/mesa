"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RESERVA_GUION, subtituloEn } from "@/mesa/guion";
import type { VistaReservaCliente, VistaSala } from "@/mesa/vista";
import { BarraPresentacion, type OrdenGuion, usePresentacion } from "./presentacion";

type Disponibilidad = {
  ahora: { fecha: string; hora: string };
  fecha: string;
  dias: { fecha: string; texto: string; abierto: boolean }[];
  maxPersonas: number;
  telefono: string;
  horas: { hora: string; servicio: string }[];
};

type MesaVista = VistaSala["mesas"][number];
type Accion = (cuerpo: Record<string, unknown>) => Promise<void>;

const ESTADO_MESA: Record<MesaVista["estado"], string> = {
  libre: "Libre",
  ocupada: "Ocupada",
  llega_pronto: "Llega pronto",
  limpiando: "Limpiando",
};

const ESTADO_RESERVA: Record<string, { texto: string; clase: string }> = {
  confirmada: { texto: "Confirmada", clase: "border border-dashed border-laton-osc text-laton-osc" },
  sentada: { texto: "En mesa", clase: "bg-vino text-lino" },
  terminada: { texto: "Terminada", clase: "bg-lino-2 text-tinta-suave" },
  cancelada: { texto: "Cancelada", clase: "text-tinta-suave line-through" },
  no_se_presento: { texto: "No se presentó", clase: "bg-lino-2 text-tinta-suave" },
};

const ORIGEN: Record<string, string> = { en_linea: "En línea", personal: "Teléfono", sin_reserva: "Sin reserva" };

async function pedir<T>(url: string, init?: RequestInit, clave?: string): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(clave ? { "x-mesa-clave": clave } : {}) },
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos.error ?? "Algo salió mal."), { status: res.status });
  return datos as T;
}

export function MesaDemo() {
  const [pestana, setPestana] = useState<"sala" | "cliente">("sala");
  const [contador, setContador] = useState(0);
  const refrescar = useCallback(() => setContador((n) => n + 1), []);

  // Modo presentación: cada momento del guion se entrega como una orden a la sala y al teléfono.
  const [orden, setOrden] = useState<OrdenGuion>();
  const [ejecucion, setEjecucion] = useState(0);
  const presentacion = usePresentacion((momento) => {
    if (momento.tipo === "reiniciar") setEjecucion((n) => n + 1);
    setOrden((o) => ({ n: (o?.n ?? 0) + 1, momento }));
  });
  const vistaGuion = presentacion.activo ? subtituloEn(presentacion.segundos).vista : undefined;
  useEffect(() => {
    if (vistaGuion) setPestana(vistaGuion);
  }, [vistaGuion]);
  const reiniciarTodo = () => {
    presentacion.detener();
    setEjecucion((n) => n + 1);
    setOrden((o) => ({ n: (o?.n ?? 0) + 1, momento: { t: 0, tipo: "reiniciar" } }));
  };

  return (
    <main className={`mx-auto max-w-[1520px] px-4 pt-5 lg:px-6 ${presentacion.activo ? "pb-44" : "pb-10"}`}>
      <div role="tablist" aria-label="Vista" className="mb-4 grid grid-cols-2 rounded-full border border-noche-3 p-1 xl:hidden">
        {(["sala", "cliente"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={pestana === p}
            onClick={() => setPestana(p)}
            className={`rounded-full py-2 text-sm font-semibold ${pestana === p ? "bg-lino text-tinta" : "text-lino/75"}`}
          >
            {p === "cliente" ? "Así reserva tu cliente" : "Sala en vivo"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className={`min-w-0 ${pestana === "sala" ? "" : "hidden xl:block"}`} aria-label="Sala en vivo">
          <Sala cambioExterno={contador} orden={orden} alPresentar={presentacion.activo ? undefined : presentacion.empezar} />
        </section>
        <section className={`min-w-0 ${pestana === "cliente" ? "" : "hidden xl:block"}`} aria-label="Reserva en línea">
          <ReservaCliente key={ejecucion} cambio={contador} alReservar={refrescar} orden={orden} />
        </section>
      </div>

      {presentacion.activo && (
        <BarraPresentacion
          segundos={presentacion.segundos}
          terminado={presentacion.terminado}
          alRepetir={presentacion.empezar}
          alReiniciar={reiniciarTodo}
          alCerrar={presentacion.detener}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sala en vivo (personal)
// ---------------------------------------------------------------------------

function Sala({ cambioExterno, orden, alPresentar }: { cambioExterno: number; orden?: OrdenGuion; alPresentar?: () => void }) {
  const [vista, setVista] = useState<VistaSala>();
  const [clave, setClave] = useState<string>();
  const [pideClave, setPideClave] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean }>();
  const [seleccion, setSeleccion] = useState<string>();
  const [resaltar, setResaltar] = useState(false);

  useEffect(() => {
    try {
      setClave(sessionStorage.getItem("mesa-clave") ?? undefined);
    } catch {}
  }, []);

  const cargar = useCallback(() => {
    pedir<VistaSala>("/api/sala", undefined, clave)
      .then((v) => { setVista(v); setPideClave(false); })
      .catch((e: Error & { status?: number }) => { if (e.status === 401) setPideClave(true); });
  }, [clave]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 3000);
    return () => clearInterval(t);
  }, [cargar, cambioExterno]);

  const accion: Accion = useCallback(async (cuerpo) => {
    try {
      const r = await pedir<{ aviso?: string; vista: VistaSala }>("/api/sala", { method: "POST", body: JSON.stringify(cuerpo) }, clave);
      setVista(r.vista);
      setAviso(r.aviso ? { texto: r.aviso } : undefined);
    } catch (e) {
      setAviso({ texto: (e as Error).message, error: true });
    }
  }, [clave]);

  // Órdenes del modo presentación que tocan a la sala.
  useEffect(() => {
    if (!orden) return;
    const m = orden.momento;
    if (m.tipo === "reiniciar") {
      setSeleccion(undefined);
      setAviso(undefined);
      setResaltar(false);
      accion({ accion: "reiniciar" });
    } else if (m.tipo === "sin_reserva") accion({ accion: "sin_reserva", nombre: m.nombre, personas: m.personas });
    else if (m.tipo === "avanzar_reloj") accion({ accion: "avanzar_reloj", minutos: m.minutos });
    else if (m.tipo === "enfocar_mesa") setSeleccion(m.mesaId);
    else if (m.tipo === "resaltar_metricas") setResaltar(true);
    // Solo reacciona a una orden nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden?.n]);

  if (pideClave) return <PedirClave alEnviar={(c) => { try { sessionStorage.setItem("mesa-clave", c); } catch {} setClave(c); }} />;
  if (!vista) return <p className="p-6 text-lino/75">Cargando la sala…</p>;

  const mesaSel = vista.mesas.find((x) => x.id === seleccion);

  return (
    <div className="space-y-5">
      <Cabecera vista={vista} accion={accion} resaltar={resaltar} alPresentar={alPresentar} alReiniciar={() => { setSeleccion(undefined); setAviso(undefined); setResaltar(false); }} />

      {aviso && (
        <p role="status" className={`rounded-lg border-l-4 px-4 py-2.5 text-sm ${aviso.error ? "border-vino-vivo bg-vino/40 text-lino" : "border-laton bg-noche-2 text-lino"}`}>
          {aviso.texto}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Plano vista={vista} seleccion={seleccion} alElegir={(id) => setSeleccion((s) => (s === id ? undefined : id))} />
          <FichaMesa mesa={mesaSel} accion={accion} alCerrar={() => setSeleccion(undefined)} />
        </div>
        <div className="space-y-5">
          <Puerta vista={vista} accion={accion} />
          <Actividad vista={vista} />
        </div>
      </div>

      <LibroReservas vista={vista} accion={accion} />
    </div>
  );
}

function Cabecera({ vista, accion, alReiniciar, alPresentar, resaltar }: { vista: VistaSala; accion: Accion; alReiniciar: () => void; alPresentar?: () => void; resaltar: boolean }) {
  const m = vista.metricas;
  return (
    <header className="flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-noche-3 pb-5">
      <div className="mr-auto">
        <h1 className="text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.95] text-lino">La Ceiba</h1>
        <p className="mt-1 text-sm text-lino/75">Cocina de mercado en Ciudad de México. Restaurante ficticio para la demo.</p>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <p className="text-xs text-lino/75 first-letter:uppercase">{vista.fechaTexto}</p>
          <p className="rotulo cifra text-5xl leading-none text-laton" aria-label={`Son las ${vista.reloj.hora}`}>{vista.reloj.hora}</p>
        </div>
        {vista.demo && (
          <div className="flex flex-col gap-1.5">
            <button onClick={() => accion({ accion: "avanzar_reloj", minutos: 15 })} className="rounded-md bg-laton px-3 py-1.5 text-sm font-bold text-tinta hover:bg-lino">
              +15 min
            </button>
            <button onClick={() => { alReiniciar(); accion({ accion: "reiniciar" }); }} className="rounded-md border border-noche-3 px-3 py-1.5 text-sm text-lino/85 hover:border-lino/60">
              Reiniciar
            </button>
          </div>
        )}
        {vista.demo && alPresentar && (
          <button onClick={alPresentar} className="self-stretch rounded-md border-2 border-laton px-4 text-sm font-bold text-laton hover:bg-laton hover:text-tinta">
            Ver la demo
            <span className="block text-xs font-normal">60 segundos</span>
          </button>
        )}
      </div>

      <dl className="grid w-full grid-cols-3 gap-x-5 gap-y-3 sm:grid-cols-5" aria-label="Resumen del servicio">
        <Dato titulo="personas en mesa" valor={m.sentadosAhora} extra={`${m.ocupacionPct} % de las plazas`} />
        <Dato titulo="reservas hoy" valor={m.reservasHoy} extra={`${m.comensalesPrevistos} personas`} />
        <Dato titulo="en espera" valor={m.enEspera} />
        <Dato titulo="no llegaron" valor={m.ausencias} resaltar={resaltar} />
        <Dato titulo="sentados desde la espera" valor={m.rescatadosDeEspera} resaltar={resaltar} />
      </dl>
    </header>
  );
}

function Dato({ titulo, valor, extra, resaltar }: { titulo: string; valor: number; extra?: string; resaltar?: boolean }) {
  return (
    <div className={`flex flex-col-reverse ${resaltar ? "-mx-2 rounded-md px-2 outline-2 outline-laton [&_dd]:text-laton" : ""}`}>
      <dt className="text-xs leading-snug text-lino/75">
        {titulo}
        {extra && <span className="block text-lino/60">{extra}</span>}
      </dt>
      <dd className="rotulo cifra text-3xl leading-tight text-lino">{valor}</dd>
    </div>
  );
}

// --- Plano -----------------------------------------------------------------

/** Posición de cada silla, en % de la caja de la mesa. */
function sillas(forma: MesaVista["forma"], capacidad: number): { x: number; y: number }[] {
  if (forma === "redonda") {
    return Array.from({ length: capacidad }, (_, i) => {
      const a = (i / capacidad) * 2 * Math.PI + (capacidad === 2 ? 0 : -Math.PI / 2);
      return { x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a) };
    });
  }
  if (forma === "rectangular") {
    const lado = Math.max(1, Math.floor((capacidad - 2) / 2));
    const xs = Array.from({ length: lado }, (_, i) => 20 + ((i + 1) * 60) / (lado + 1));
    return [...xs.map((x) => ({ x, y: 9 })), ...xs.map((x) => ({ x, y: 91 })), { x: 5, y: 50 }, { x: 95, y: 50 }].slice(0, capacidad);
  }
  return [{ x: 50, y: 9 }, { x: 91, y: 50 }, { x: 50, y: 91 }, { x: 9, y: 50 }].slice(0, capacidad);
}

/** Sillas con gente en vino y lino; las reservadas que aún no llegan, en latón; las vacías, en el color de la mesa. */
function claseSilla(estado: MesaVista["estado"], conGente: boolean): string {
  if (estado === "limpiando") return "silla-limpiando";
  if (!conGente) return estado === "ocupada" ? "silla-libre opacity-50" : "silla-libre";
  return estado === "llega_pronto" ? "silla-llega_pronto" : "silla-ocupada";
}

const COLUMNAS = 12;
const FILAS = 9;

function Plano({ vista, seleccion, alElegir }: { vista: VistaSala; seleccion?: string; alElegir: (id: string) => void }) {
  const celda = (x: number, y: number, ancho: number, alto: number) => ({
    left: `${((x - 1) / COLUMNAS) * 100}%`,
    top: `${((y - 1) / FILAS) * 100}%`,
    width: `${(ancho / COLUMNAS) * 100}%`,
    height: `${(alto / FILAS) * 100}%`,
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <h2 className="mr-auto text-2xl text-lino">El salón ahora</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-lino/80" aria-label="Leyenda">
          {(Object.keys(ESTADO_MESA) as MesaVista["estado"][]).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={`mantel inline-block size-3.5 rounded-sm mantel-${k}`} aria-hidden /> {ESTADO_MESA[k]}
            </li>
          ))}
        </ul>
      </div>

      <div className="suelo relative aspect-[12/9] w-full overflow-hidden rounded-lg border border-noche-3">
        <div className="terraza absolute rounded-l-md border-l border-dashed border-oliva/50" style={celda(9.6, 1, 3.4, 9)} aria-hidden>
          <div className="macetas absolute inset-y-0 left-0 w-[9%] opacity-70" />
          <p className="absolute bottom-[2%] right-[6%] text-[max(10px,1.3cqi)] text-oliva-clara/85">Terraza</p>
        </div>
        <div className="barra absolute flex items-center justify-center rounded-sm" style={{ ...celda(1, 9.25, 5, 0.6) }} aria-hidden>
          <span className="text-[max(10px,1.3cqi)] font-semibold text-lino/90">Barra</span>
        </div>
        <div className="absolute flex items-end justify-center" style={celda(7, 8.6, 2, 1.4)} aria-hidden>
          <span className="block h-[70%] w-[45%] rounded-tr-full border-r-2 border-t-2 border-lino/30" />
          <span className="absolute bottom-[4%] right-0 text-[max(10px,1.2cqi)] text-lino/70">Entrada</span>
        </div>

        {vista.mesas.map((m) => {
          const ancho = m.forma === "rectangular" ? 3 : 2;
          const enciende = vista.ultimoCambio?.mesaIds.includes(m.id);
          const puestos = sillas(m.forma, m.capacidad);
          const elegida = seleccion === m.id;
          const sub = m.estado === "libre" ? (m.proxima ? `reserva ${m.proxima.split(" ·")[0]}` : `${m.capacidad} plazas`) : m.detalle.split(" · ")[0];
          return (
            <button
              key={enciende ? `${m.id}-${vista.ultimoCambio?.n}` : m.id}
              onClick={() => alElegir(m.id)}
              aria-pressed={elegida}
              style={celda(m.x, m.y, ancho, 2)}
              className={`group absolute rounded-xl outline-offset-0 ${enciende ? "enciende" : ""}`}
            >
              {puestos.map((p, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={`silla absolute aspect-square h-[15%] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    claseSilla(m.estado, i < m.sillasOcupadas)
                  }`}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                />
              ))}
              <span
                className={`mantel absolute flex flex-col items-center justify-center px-1 text-center mantel-${m.estado} ${
                  m.forma === "redonda" ? "inset-[21%] rounded-full" : m.forma === "rectangular" ? "inset-x-[12%] inset-y-[20%] rounded-md" : "inset-[20%] rounded-md"
                } ${elegida ? "ring-[3px] ring-laton ring-offset-2 ring-offset-noche-2" : "group-hover:brightness-105"}`}
              >
                <span className="rotulo num-mesa"><span className="sr-only">Mesa </span>{m.nombre}</span>
                <span className="det-mesa mt-0.5 max-w-full truncate font-semibold leading-tight">{sub}</span>
                <span className="sr-only">{`, ${m.capacidad} plazas: ${ESTADO_MESA[m.estado]}. ${m.detalle}`}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FichaMesa({ mesa, accion, alCerrar }: { mesa?: MesaVista; accion: Accion; alCerrar: () => void }) {
  if (!mesa) {
    return <p className="mt-3 text-sm text-lino/75">Toca una mesa para ver quién está y marcar su llegada o su salida.</p>;
  }
  const principal =
    mesa.estado === "llega_pronto" && mesa.reservaId
      ? { texto: "Ya llegaron, sentar", cuerpo: { accion: "sentar", id: mesa.reservaId } }
      : mesa.estado === "ocupada" && mesa.reservaId
        ? { texto: "Pagaron, liberar mesa", cuerpo: { accion: "liberar", id: mesa.reservaId } }
        : undefined;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg bg-lino px-4 py-3 text-tinta" aria-live="polite">
      <p className="rotulo text-3xl leading-none">Mesa {mesa.nombre}</p>
      <div className="min-w-40 flex-1 text-sm">
        <p className="font-semibold">{ESTADO_MESA[mesa.estado]}, {mesa.capacidad} plazas</p>
        <p className="text-tinta-suave">
          {mesa.detalle}
          {mesa.proxima ? `. Próxima reserva: ${mesa.proxima.replace(" · ", ", ")} personas` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        {principal && (
          <button onClick={() => accion(principal.cuerpo)} className="rounded-md bg-vino px-4 py-2 text-sm font-bold text-lino hover:bg-vino-vivo">
            {principal.texto}
          </button>
        )}
        <button onClick={alCerrar} className="rounded-md border border-lino-2 px-3 py-2 text-sm text-tinta-suave hover:border-tinta-suave">
          Cerrar
        </button>
      </div>
    </div>
  );
}

// --- La puerta: sin reserva y lista de espera -----------------------------

function Puerta({ vista, accion }: { vista: VistaSala; accion: Accion }) {
  const [nombre, setNombre] = useState("");
  const [personas, setPersonas] = useState(4);
  return (
    <div className="rounded-lg border border-noche-3 p-4">
      <h2 className="text-xl text-lino">En la puerta</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          accion({ accion: "sin_reserva", nombre, personas });
          setNombre("");
        }}
        className="mt-3"
      >
        <p className="mb-2 text-sm text-lino/75">Llega gente sin reserva. Si hay mesa, pasan ya; si no, les das un tiempo de espera.</p>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Nombre</span>
            <input value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (opcional)" className="w-full rounded-md border border-noche-3 bg-noche-2 px-3 py-2 text-sm text-lino placeholder:text-lino/55" />
          </label>
          <label>
            <span className="sr-only">Personas</span>
            <select value={personas} onChange={(e) => setPersonas(Number(e.target.value))} className="rounded-md border border-noche-3 bg-noche-2 px-2 py-2 text-sm text-lino">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} pers.</option>
              ))}
            </select>
          </label>
        </div>
        <button className="mt-2 w-full rounded-md bg-lino py-2 text-sm font-bold text-tinta hover:bg-laton">Buscar mesa</button>
      </form>

      <h3 className="mt-5 text-lg text-lino">Lista de espera</h3>
      {vista.espera.length === 0 ? (
        <p className="mt-1 text-sm text-lino/75">Nadie esperando.</p>
      ) : (
        <ol className="mt-2 space-y-2 text-sm">
          {vista.espera.map((e, i) => (
            <li key={e.id} className="flex items-center gap-2.5">
              <span className="rotulo cifra w-4 text-lino/70">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-lino">{e.nombre}</span>
                <span className="block text-xs text-lino/70">{e.personas} personas, llegó a las {e.llegada}</span>
              </span>
              <span className="rotulo cifra text-lg text-laton">{e.estimacionMin === null ? "+3 h" : `${e.estimacionMin} min`}</span>
              <button onClick={() => accion({ accion: "retirar_espera", id: e.id })} className="rounded-md border border-noche-3 px-2 py-1 text-xs text-lino/80 hover:border-lino/60">
                Se fue
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Actividad({ vista }: { vista: VistaSala }) {
  return (
    <div>
      <h2 className="text-lg text-lino">Lo último en la sala</h2>
      {vista.eventos.length === 0 ? (
        <p className="mt-1 text-sm text-lino/75">Aquí verás cada llegada, salida y ausencia. Prueba a reservar o a avanzar el reloj.</p>
      ) : (
        <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1 text-sm" aria-live="polite">
          {vista.eventos.map((e) => (
            <li key={e.id} className="grid grid-cols-[3rem_1fr] gap-2">
              <span className="cifra text-lino/65">{e.hora}</span>
              <span className="text-lino/90">{e.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Libro de reservas -----------------------------------------------------

function LibroReservas({ vista, accion }: { vista: VistaSala; accion: Accion }) {
  return (
    <div className="rounded-lg bg-lino px-4 py-4 text-tinta sm:px-6">
      <h2 className="text-2xl">Libro de reservas de hoy</h2>
      <ul className="mt-2 text-sm">
        {vista.reservasHoy.map((r) => {
          const e = ESTADO_RESERVA[r.estado];
          return (
            <li key={r.id} className="grid grid-cols-[3.4rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-lino-2 py-2.5 last:border-0 sm:grid-cols-[3.4rem_minmax(0,1fr)_6rem_7.5rem_9.5rem]">
              <span className="rotulo cifra text-lg">{r.hora}</span>
              <span className="min-w-0">
                <span className="font-semibold">{r.nombre}</span>
                <span className="text-tinta-suave">, {r.personas} pers., {r.mesas}</span>
                {r.notas && <span className="block text-xs text-tinta-suave">{r.notas}</span>}
              </span>
              <span className="hidden text-xs text-tinta-suave sm:block">{ORIGEN[r.origen]}</span>
              <span className={`justify-self-start rounded px-2 py-0.5 text-xs font-semibold ${e.clase}`}>{e.texto}</span>
              <span className="col-span-2 col-start-2 flex gap-1.5 sm:col-span-1 sm:col-start-auto sm:justify-end">
                {r.estado === "confirmada" && (
                  <>
                    <button onClick={() => accion({ accion: "sentar", id: r.id })} className="rounded-md bg-vino px-2.5 py-1 text-xs font-bold text-lino hover:bg-vino-vivo">Llegó</button>
                    <button onClick={() => accion({ accion: "cancelar", id: r.id })} className="rounded-md border border-lino-2 px-2.5 py-1 text-xs text-tinta-suave hover:border-tinta-suave">Cancelar</button>
                  </>
                )}
                {r.estado === "sentada" && (
                  <button onClick={() => accion({ accion: "liberar", id: r.id })} className="rounded-md border border-lino-2 px-2.5 py-1 text-xs text-tinta-suave hover:border-tinta-suave">Liberar</button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista del cliente: un teléfono con la reserva en línea
// ---------------------------------------------------------------------------

function ReservaCliente({ cambio, alReservar, orden }: { cambio: number; alReservar: () => void; orden?: OrdenGuion }) {
  const [personas, setPersonas] = useState(2);
  const [fecha, setFecha] = useState<string>();
  const [hora, setHora] = useState<string>();
  const [disp, setDisp] = useState<Disponibilidad>();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [reserva, setReserva] = useState<VistaReservaCliente>();

  useEffect(() => {
    const q = new URLSearchParams({ personas: String(personas), ...(fecha ? { fecha } : {}) });
    pedir<Disponibilidad>(`/api/disponibilidad?${q}`)
      .then((d) => {
        setDisp(d);
        if (!fecha) setFecha(d.fecha);
      })
      .catch((e: Error) => setError(e.message));
  }, [personas, fecha, cambio]);

  useEffect(() => setHora(undefined), [personas, fecha]);

  // Modo presentación: el teléfono se rellena solo y reserva.
  const horaPendiente = useRef<string>(undefined);
  useEffect(() => {
    if (!orden || !disp) return;
    const m = orden.momento;
    if (m.tipo === "rellenar_reserva") {
      setReserva(undefined);
      setPersonas(RESERVA_GUION.personas);
      setFecha(disp.ahora.fecha);
      horaPendiente.current = RESERVA_GUION.hora;
      if (disp.fecha === disp.ahora.fecha && personas === RESERVA_GUION.personas) setHora(RESERVA_GUION.hora);
      return escribir([[setNombre, RESERVA_GUION.nombre], [setTelefono, RESERVA_GUION.telefono]]);
    }
    if (m.tipo === "enviar_reserva") void reservar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden?.n]);
  useEffect(() => {
    if (horaPendiente.current && disp?.horas.some((h) => h.hora === horaPendiente.current) && disp.fecha === fecha) {
      setHora(horaPendiente.current);
      horaPendiente.current = undefined;
    }
  }, [disp, fecha]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    await reservar();
  }

  async function reservar() {
    if (!fecha || !hora) return;
    setEnviando(true);
    setError(undefined);
    try {
      const r = await pedir<VistaReservaCliente>("/api/reservas", {
        method: "POST",
        body: JSON.stringify({ nombre, telefono, personas, fecha, hora, notas: notas || undefined }),
      });
      setReserva(r);
      alReservar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function cancelarMia() {
    if (!reserva) return;
    try {
      setReserva(await pedir<VistaReservaCliente>(`/api/reservas/${reserva.codigo}`, { method: "DELETE" }));
      alReservar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const servicios = Array.from(new Set(disp?.horas.map((h) => h.servicio) ?? []));
  const campo = "mt-1 w-full rounded-md border border-lino-2 bg-white px-3 py-2 text-tinta";

  return (
    <div className="mx-auto max-w-[360px] xl:sticky xl:top-5">
      <p className="mb-3 text-sm text-lino/75">Así reserva tu cliente desde su teléfono. Solo ve horas con mesa libre de verdad.</p>
      <div className="rounded-[2.2rem] border-[10px] border-noche-3 bg-lino text-tinta shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)]">
        <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-lino-2" aria-hidden />
        <div className="border-b border-lino-2 px-5 pb-4 pt-3">
          <p className="rotulo text-3xl leading-none text-vino">La Ceiba</p>
          <h2 className="mt-1 font-sans text-sm font-semibold text-tinta-suave">Reserva tu mesa</h2>
        </div>

        {reserva ? (
          <div className="space-y-4 p-5" aria-live="polite">
            {reserva.estado === "cancelada" ? (
              <>
                <h3 className="text-2xl">Reserva cancelada</h3>
                <p className="text-sm text-tinta-suave">Gracias por avisarnos. Tu mesa queda libre para otra persona.</p>
              </>
            ) : (
              <>
                <h3 className="text-2xl">Te esperamos, {reserva.nombre.split(" ")[0]}</h3>
                <p className="text-sm">
                  El <strong>{reserva.fechaTexto}</strong> a las <strong className="cifra">{reserva.hora}</strong>, mesa para {reserva.personas}.
                  Te guardamos la mesa {reserva.toleranciaMin} minutos.
                </p>
                <p className="rounded-md border border-dashed border-lino-2 bg-white/60 px-3 py-2 text-xs text-tinta-suave">
                  Código de tu reserva: <span className="cifra font-mono text-tinta">{reserva.codigo.slice(0, 8)}</span>. Con él puedes
                  consultarla o cancelarla.
                </p>
                <button onClick={cancelarMia} className="w-full rounded-md border border-vino py-2.5 text-sm font-semibold text-vino hover:bg-vino hover:text-lino">
                  Cancelar mi reserva
                </button>
              </>
            )}
            <button onClick={() => { setReserva(undefined); setHora(undefined); }} className="w-full py-2 text-sm text-tinta-suave underline">
              Hacer otra reserva
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-5 p-5">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-semibold">¿Cuántas personas?</legend>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Una persona menos" onClick={() => setPersonas((p) => Math.max(1, p - 1))} className="size-10 rounded-full border border-lino-2 text-lg hover:border-vino">−</button>
                <span className="rotulo cifra w-10 text-center text-3xl" aria-live="polite">{personas}</span>
                <button type="button" aria-label="Una persona más" onClick={() => setPersonas((p) => Math.min(disp?.maxPersonas ?? 8, p + 1))} className="size-10 rounded-full border border-lino-2 text-lg hover:border-vino">+</button>
                <span className="text-xs text-tinta-suave">Más de {disp?.maxPersonas ?? 8}: llámanos.</span>
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-semibold">¿Qué día?</legend>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {disp?.dias.map((d) => (
                  <button
                    type="button"
                    key={d.fecha}
                    disabled={!d.abierto}
                    aria-pressed={fecha === d.fecha}
                    onClick={() => setFecha(d.fecha)}
                    className={`shrink-0 rounded-md border px-3 py-2 text-sm capitalize ${fecha === d.fecha ? "border-vino bg-vino text-lino" : "border-lino-2 hover:border-vino"} disabled:opacity-40`}
                    title={d.abierto ? undefined : "Cerrado"}
                  >
                    {d.texto}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-semibold">¿A qué hora?</legend>
              {disp && disp.horas.length === 0 && <p className="text-sm text-tinta-suave">No nos quedan mesas ese día para {personas}. Prueba otro día.</p>}
              {servicios.map((s) => (
                <div key={s} className="mb-2">
                  <p className="mb-1 text-xs font-semibold text-tinta-suave">{s}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {disp!.horas.filter((h) => h.servicio === s).map((h) => (
                      <button
                        type="button"
                        key={h.hora}
                        aria-pressed={hora === h.hora}
                        onClick={() => setHora(h.hora)}
                        className={`cifra rounded-md border px-2.5 py-1.5 text-sm ${hora === h.hora ? "border-oliva-osc bg-oliva-osc text-lino" : "border-lino-2 hover:border-oliva"}`}
                      >
                        {h.hora}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>

            {hora && (
              <div className="space-y-2">
                <label className="block text-sm">
                  <span className="font-semibold">Nombre</span>
                  <input required minLength={2} maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} autoComplete="name" />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold">Teléfono (WhatsApp)</span>
                  <input required type="tel" pattern="\+?[\d\s()\-]{7,20}" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+52 55 1234 5678" className={campo} autoComplete="tel" />
                </label>
                <label className="block text-sm">
                  <span className="font-semibold">Algo que debamos saber</span> <span className="text-tinta-suave">(opcional)</span>
                  <input maxLength={200} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Alergias, silla para bebé, cumpleaños…" className={campo} />
                </label>
              </div>
            )}

            {error && <p role="alert" className="rounded-md bg-vino/10 px-3 py-2 text-sm text-vino">{error}</p>}

            <button disabled={!hora || enviando} className="w-full rounded-md bg-vino py-3 font-bold text-lino hover:bg-vino-vivo disabled:opacity-45">
              {enviando ? "Reservando…" : hora ? `Reservar a las ${hora}` : "Elige una hora"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Escribe los textos letra a letra (o de golpe con movimiento reducido). Devuelve la limpieza. */
function escribir(campos: [(v: string) => void, string][]): () => void {
  const reducido = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducido) {
    campos.forEach(([set, v]) => set(v));
    return () => {};
  }
  let campo = 0;
  let letra = 0;
  campos.forEach(([set]) => set(""));
  const t = setInterval(() => {
    if (campo >= campos.length) return clearInterval(t);
    const [set, valor] = campos[campo];
    letra += 1;
    set(valor.slice(0, letra));
    if (letra >= valor.length) { campo += 1; letra = 0; }
  }, 55);
  return () => clearInterval(t);
}

function PedirClave({ alEnviar }: { alEnviar: (c: string) => void }) {
  const [valor, setValor] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); alEnviar(valor); }} className="mx-auto mt-10 max-w-sm space-y-3 rounded-lg bg-lino p-6 text-tinta">
      <h2 className="text-2xl">Acceso del personal</h2>
      <label className="block text-sm">
        <span>Clave de la sala</span>
        <input type="password" required value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1 w-full rounded-md border border-lino-2 bg-white px-3 py-2" autoComplete="current-password" />
      </label>
      <button className="w-full rounded-md bg-vino py-2 font-bold text-lino">Entrar</button>
    </form>
  );
}
