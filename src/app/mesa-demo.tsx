"use client";

import { useCallback, useEffect, useState } from "react";
import type { VistaReservaCliente, VistaSala } from "@/mesa/vista";

type Disponibilidad = {
  ahora: { fecha: string; hora: string };
  fecha: string;
  dias: { fecha: string; texto: string; abierto: boolean }[];
  maxPersonas: number;
  telefono: string;
  horas: { hora: string; servicio: string }[];
};

const ESTADO_MESA = {
  libre: { texto: "Libre", clase: "bg-nopal-claro border-nopal text-nopal" },
  ocupada: { texto: "Ocupada", clase: "bg-achiote-claro border-achiote text-achiote" },
  llega_pronto: { texto: "Llega pronto", clase: "bg-maiz-claro border-maiz text-maiz" },
  limpiando: { texto: "Limpiando", clase: "bg-pizarra-claro border-pizarra text-pizarra" },
} as const;

const ESTADO_RESERVA: Record<string, { texto: string; clase: string }> = {
  confirmada: { texto: "Confirmada", clase: "bg-maiz-claro text-maiz" },
  sentada: { texto: "En mesa", clase: "bg-achiote-claro text-achiote" },
  terminada: { texto: "Terminada", clase: "bg-pizarra-claro text-pizarra" },
  cancelada: { texto: "Cancelada", clase: "bg-borde/60 text-tinta-suave line-through" },
  no_se_presento: { texto: "No se presentó", clase: "bg-borde/60 text-tinta-suave" },
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
  const [pestana, setPestana] = useState<"cliente" | "sala">("sala");
  const [contador, setContador] = useState(0);
  const refrescar = useCallback(() => setContador((n) => n + 1), []);

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-5 lg:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-achiote">Mesa · demo de la Fábrica</p>
          <h1 className="text-3xl font-semibold leading-tight">La Ceiba <span className="font-normal italic text-tinta-suave">cocina de mercado</span></h1>
        </div>
        <p className="max-w-md text-sm text-tinta-suave">
          Restaurante ficticio. Una vista es lo que ve tu cliente al reservar; la otra, la sala en vivo para el personal.
        </p>
      </header>

      <div role="tablist" aria-label="Vista" className="mb-4 grid grid-cols-2 rounded-full border border-borde bg-crema p-1 lg:hidden">
        {(["cliente", "sala"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={pestana === p}
            onClick={() => setPestana(p)}
            className={`rounded-full py-2 text-sm font-medium ${pestana === p ? "bg-tinta text-crema" : "text-tinta-suave"}`}
          >
            {p === "cliente" ? "Reserva en línea" : "Sala en vivo"}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className={`min-w-0 ${pestana === "cliente" ? "" : "hidden lg:block"}`} aria-label="Reserva en línea">
          <ReservaCliente cambio={contador} alReservar={refrescar} />
        </section>
        <section className={`min-w-0 ${pestana === "sala" ? "" : "hidden lg:block"}`} aria-label="Sala en vivo">
          <Sala cambioExterno={contador} />
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Vista del cliente
// ---------------------------------------------------------------------------

function ReservaCliente({ cambio, alReservar }: { cambio: number; alReservar: () => void }) {
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

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div className="overflow-hidden rounded-[28px] border border-borde bg-crema shadow-[0_10px_40px_-20px_rgb(33_26_20/0.35)]">
      <div className="bg-tinta px-5 pb-5 pt-4 text-crema">
        <p className="text-xs uppercase tracking-[0.16em] text-crema/60">Vista del cliente</p>
        <h2 className="mt-1 text-2xl">Reserva tu mesa</h2>
        <p className="text-sm text-crema/70">La Ceiba · Ciudad de México</p>
      </div>

      {reserva ? (
        <div className="space-y-4 p-5" aria-live="polite">
          {reserva.estado === "cancelada" ? (
            <>
              <h3 className="text-xl">Reserva cancelada</h3>
              <p className="text-sm text-tinta-suave">Gracias por avisarnos. Tu mesa queda libre para otra persona.</p>
            </>
          ) : (
            <>
              <h3 className="text-xl">¡Listo, {reserva.nombre.split(" ")[0]}!</h3>
              <p className="text-sm">
                Te esperamos el <strong>{reserva.fechaTexto}</strong> a las <strong className="cifra">{reserva.hora}</strong>, mesa para{" "}
                {reserva.personas}. Te guardamos la mesa {reserva.toleranciaMin} minutos.
              </p>
              <p className="rounded-xl border border-dashed border-borde bg-papel px-3 py-2 text-xs text-tinta-suave">
                Código de tu reserva: <span className="cifra font-mono text-tinta">{reserva.codigo.slice(0, 8)}</span>. Con él puedes
                consultarla o cancelarla.
              </p>
              <button onClick={cancelarMia} className="w-full rounded-full border border-achiote py-2.5 text-sm font-medium text-achiote hover:bg-achiote-claro">
                Cancelar mi reserva
              </button>
            </>
          )}
          <button onClick={() => { setReserva(undefined); setHora(undefined); }} className="w-full rounded-full py-2 text-sm text-tinta-suave underline">
            Hacer otra reserva
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-5 p-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">¿Cuántas personas?</legend>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Una persona menos" onClick={() => setPersonas((p) => Math.max(1, p - 1))} className="size-10 rounded-full border border-borde text-lg">−</button>
              <span className="cifra w-10 text-center text-2xl font-semibold" aria-live="polite">{personas}</span>
              <button type="button" aria-label="Una persona más" onClick={() => setPersonas((p) => Math.min(disp?.maxPersonas ?? 8, p + 1))} className="size-10 rounded-full border border-borde text-lg">+</button>
              <span className="text-xs text-tinta-suave">Más de {disp?.maxPersonas ?? 8}: llámanos.</span>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">¿Qué día?</legend>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {disp?.dias.map((d) => (
                <button
                  type="button"
                  key={d.fecha}
                  disabled={!d.abierto}
                  aria-pressed={fecha === d.fecha}
                  onClick={() => setFecha(d.fecha)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-sm capitalize ${fecha === d.fecha ? "border-tinta bg-tinta text-crema" : "border-borde"} disabled:opacity-35`}
                  title={d.abierto ? undefined : "Cerrado"}
                >
                  {d.texto}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">¿A qué hora?</legend>
            {disp && disp.horas.length === 0 && <p className="text-sm text-tinta-suave">No nos quedan mesas ese día para {personas}. Prueba otro día.</p>}
            {servicios.map((s) => (
              <div key={s} className="mb-2">
                <p className="mb-1 text-xs uppercase tracking-wider text-tinta-suave">{s}</p>
                <div className="flex flex-wrap gap-1.5">
                  {disp!.horas.filter((h) => h.servicio === s).map((h) => (
                    <button
                      type="button"
                      key={h.hora}
                      aria-pressed={hora === h.hora}
                      onClick={() => setHora(h.hora)}
                      className={`cifra rounded-lg border px-2.5 py-1.5 text-sm ${hora === h.hora ? "border-achiote bg-achiote text-crema" : "border-borde hover:border-achiote"}`}
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
                <input required minLength={2} maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded-xl border border-borde bg-white px-3 py-2" autoComplete="name" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold">Teléfono (WhatsApp)</span>
                <input required type="tel" pattern="\+?[\d\s()\-]{7,20}" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+52 55 1234 5678" className="mt-1 w-full rounded-xl border border-borde bg-white px-3 py-2" autoComplete="tel" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold">Algo que debamos saber</span> <span className="text-tinta-suave">(opcional)</span>
                <input maxLength={200} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Alergias, silla para bebé, cumpleaños…" className="mt-1 w-full rounded-xl border border-borde bg-white px-3 py-2" />
              </label>
            </div>
          )}

          {error && <p role="alert" className="rounded-xl bg-achiote-claro px-3 py-2 text-sm text-achiote">{error}</p>}

          <button disabled={!hora || enviando} className="w-full rounded-full bg-achiote py-3 font-semibold text-crema disabled:opacity-40">
            {enviando ? "Reservando…" : hora ? `Reservar a las ${hora}` : "Elige una hora"}
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sala en vivo (personal)
// ---------------------------------------------------------------------------

function Sala({ cambioExterno }: { cambioExterno: number }) {
  const [vista, setVista] = useState<VistaSala>();
  const [clave, setClave] = useState<string>();
  const [pideClave, setPideClave] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean }>();
  const [seleccion, setSeleccion] = useState<string>();

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

  async function accion(cuerpo: Record<string, unknown>) {
    try {
      const r = await pedir<{ aviso?: string; vista: VistaSala }>("/api/sala", { method: "POST", body: JSON.stringify(cuerpo) }, clave);
      setVista(r.vista);
      setAviso(r.aviso ? { texto: r.aviso } : undefined);
    } catch (e) {
      setAviso({ texto: (e as Error).message, error: true });
    }
  }

  if (pideClave) return <PedirClave alEnviar={(c) => { try { sessionStorage.setItem("mesa-clave", c); } catch {} setClave(c); }} />;
  if (!vista) return <p className="p-6 text-tinta-suave">Cargando la sala…</p>;

  const m = vista.metricas;
  const mesaSel = vista.mesas.find((x) => x.id === seleccion);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-borde bg-crema px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-tinta-suave first-letter:uppercase">{vista.fechaTexto}</p>
          <p className="cifra serif text-3xl font-semibold leading-none">{vista.reloj.hora}</p>
        </div>
        {vista.demo && (
          <div className="flex gap-2">
            <button onClick={() => accion({ accion: "avanzar_reloj", minutos: 15 })} className="rounded-full bg-tinta px-4 py-2 text-sm font-semibold text-crema">
              +15 min
            </button>
            <button onClick={() => { setSeleccion(undefined); setAviso(undefined); accion({ accion: "reiniciar" }); }} className="rounded-full border border-borde px-4 py-2 text-sm">
              Reiniciar demo
            </button>
          </div>
        )}
        <dl className="grid w-full grid-cols-3 gap-x-4 gap-y-2 sm:ml-auto sm:w-auto sm:grid-cols-5 sm:text-right">
          <Dato titulo="En mesa" valor={`${m.sentadosAhora}`} extra={`${m.ocupacionPct}%`} />
          <Dato titulo="Reservas hoy" valor={`${m.reservasHoy}`} extra={`${m.comensalesPrevistos} pers.`} />
          <Dato titulo="En espera" valor={`${m.enEspera}`} />
          <Dato titulo="No llegaron" valor={`${m.ausencias}`} />
          <Dato titulo="Sentados desde la espera" valor={`${m.rescatadosDeEspera}`} />
        </dl>
      </div>

      {aviso && (
        <p role="status" className={`rounded-xl px-4 py-2 text-sm ${aviso.error ? "bg-achiote-claro text-achiote" : "bg-nopal-claro text-nopal"}`}>
          {aviso.texto}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Plano vista={vista} seleccion={seleccion} alElegir={setSeleccion} />
          {mesaSel && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-borde bg-crema px-4 py-3 text-sm">
              <p className="font-semibold">Mesa {mesaSel.nombre} · {mesaSel.capacidad} plazas</p>
              <p className="text-tinta-suave">{mesaSel.detalle}{mesaSel.proxima ? ` · próxima reserva ${mesaSel.proxima}` : ""}</p>
              <div className="ml-auto flex gap-2">
                {mesaSel.estado === "llega_pronto" && mesaSel.reservaId && (
                  <Boton onClick={() => accion({ accion: "sentar", id: mesaSel.reservaId })}>Ya llegaron</Boton>
                )}
                {mesaSel.estado === "ocupada" && mesaSel.reservaId && (
                  <Boton onClick={() => accion({ accion: "liberar", id: mesaSel.reservaId })}>Pagaron, liberar</Boton>
                )}
              </div>
            </div>
          )}
          <Reservas vista={vista} accion={accion} />
        </div>

        <div className="space-y-4">
          <SinReserva accion={accion} />
          <Espera vista={vista} accion={accion} />
          <Actividad vista={vista} />
        </div>
      </div>
    </div>
  );
}

function Dato({ titulo, valor, extra }: { titulo: string; valor: string; extra?: string }) {
  return (
    <div>
      <dt className="text-[11px] leading-tight text-tinta-suave">{titulo}</dt>
      <dd className="cifra text-lg font-semibold leading-tight">
        {valor} {extra && <span className="text-xs font-normal text-tinta-suave">{extra}</span>}
      </dd>
    </div>
  );
}

function Boton({ children, onClick, suave }: { children: React.ReactNode; onClick: () => void; suave?: boolean }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${suave ? "border border-borde text-tinta-suave hover:border-achiote" : "bg-tinta text-crema"}`}>
      {children}
    </button>
  );
}

function Plano({ vista, seleccion, alElegir }: { vista: VistaSala; seleccion?: string; alElegir: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-borde bg-crema p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
        <h2 className="mr-auto text-lg">Plano del salón</h2>
        {Object.entries(ESTADO_MESA).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-full border ${v.clase}`} aria-hidden /> {v.texto}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="piso relative grid min-w-[560px] grid-cols-12 grid-rows-[repeat(9,minmax(44px,1fr))] gap-1 rounded-xl p-2">
          <div className="pointer-events-none col-start-10 col-end-13 row-start-1 row-end-10 flex items-end justify-center rounded-lg border-2 border-dashed border-nopal/30 pb-1 text-[10px] uppercase tracking-[0.2em] text-nopal/80" aria-hidden>Terraza</div>
          <div className="pointer-events-none col-start-1 col-end-6 row-start-9 row-end-10 grid place-items-center rounded-md bg-tinta/10 text-[10px] uppercase tracking-[0.2em] text-tinta-suave" aria-hidden>Barra</div>
          {vista.mesas.map((m) => {
            const estilo = ESTADO_MESA[m.estado];
            const enciende = vista.ultimoCambio?.mesaIds.includes(m.id);
            const ancho = m.forma === "rectangular" ? 3 : 2;
            return (
              <button
                key={enciende ? `${m.id}-${vista.ultimoCambio?.n}` : m.id}
                onClick={() => alElegir(m.id)}
                aria-pressed={seleccion === m.id}
                aria-label={`Mesa ${m.nombre}, ${m.capacidad} plazas: ${estilo.texto}. ${m.detalle}`}
                style={{ gridColumn: `${m.x} / span ${ancho}`, gridRow: `${m.y} / span 2` }}
                className={`relative z-10 m-1 flex flex-col items-center justify-center border-2 px-1 text-center leading-tight transition ${estilo.clase} ${
                  m.forma === "redonda" ? "rounded-full" : "rounded-xl"
                } ${seleccion === m.id ? "ring-2 ring-tinta ring-offset-2 ring-offset-crema" : ""} ${enciende ? "enciende" : ""}`}
              >
                <span className="serif text-base font-semibold">{m.nombre}</span>
                <span className="text-[11px] font-medium">{m.estado === "libre" ? (m.proxima ? `reserva ${m.proxima.split(" ·")[0]}` : `${m.capacidad} plazas`) : m.detalle.split(" · ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Reservas({ vista, accion }: { vista: VistaSala; accion: (c: Record<string, unknown>) => void }) {
  return (
    <div className="rounded-2xl border border-borde bg-crema p-4">
      <h2 className="mb-2 text-lg">Reservas de hoy</h2>
      <ul className="divide-y divide-borde text-sm">
        {vista.reservasHoy.map((r) => {
          const e = ESTADO_RESERVA[r.estado];
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="cifra w-12 font-semibold">{r.hora}</span>
              <span className="min-w-36 flex-1">
                <span className="font-medium">{r.nombre}</span> <span className="text-tinta-suave">· {r.personas} · {r.mesas}</span>
                {r.notas && <span className="block text-xs text-tinta-suave">{r.notas}</span>}
              </span>
              <span className="text-xs text-tinta-suave">{ORIGEN[r.origen]}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${e.clase}`}>{e.texto}</span>
              {r.estado === "confirmada" && (
                <span className="flex gap-1.5">
                  <Boton onClick={() => accion({ accion: "sentar", id: r.id })}>Llegó</Boton>
                  <Boton suave onClick={() => accion({ accion: "cancelar", id: r.id })}>Cancelar</Boton>
                </span>
              )}
              {r.estado === "sentada" && <Boton suave onClick={() => accion({ accion: "liberar", id: r.id })}>Liberar</Boton>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SinReserva({ accion }: { accion: (c: Record<string, unknown>) => void }) {
  const [nombre, setNombre] = useState("");
  const [personas, setPersonas] = useState(4);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        accion({ accion: "sin_reserva", nombre, personas });
        setNombre("");
      }}
      className="rounded-2xl border border-achiote/40 bg-achiote-claro/50 p-4"
    >
      <h2 className="text-lg">Llega gente sin reserva</h2>
      <p className="mb-3 text-xs text-tinta-suave">Si hay mesa, pasan ya. Si no, entran en la lista con su tiempo de espera.</p>
      <div className="flex gap-2">
        <label className="flex-1 text-xs">
          <span className="sr-only">Nombre</span>
          <input value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (opcional)" className="w-full rounded-xl border border-borde bg-white px-3 py-2 text-sm" />
        </label>
        <label className="text-xs">
          <span className="sr-only">Personas</span>
          <select value={personas} onChange={(e) => setPersonas(Number(e.target.value))} className="rounded-xl border border-borde bg-white px-2 py-2 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n} pers.</option>
            ))}
          </select>
        </label>
      </div>
      <button className="mt-2 w-full rounded-full bg-achiote py-2 text-sm font-semibold text-crema">Buscar mesa</button>
    </form>
  );
}

function Espera({ vista, accion }: { vista: VistaSala; accion: (c: Record<string, unknown>) => void }) {
  return (
    <div className="rounded-2xl border border-borde bg-crema p-4">
      <h2 className="mb-2 text-lg">Lista de espera</h2>
      {vista.espera.length === 0 ? (
        <p className="text-sm text-tinta-suave">Nadie esperando.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {vista.espera.map((e, i) => (
            <li key={e.id} className="flex items-center gap-2">
              <span className="cifra grid size-6 place-items-center rounded-full bg-tinta text-xs text-crema">{i + 1}</span>
              <span className="flex-1">
                <span className="font-medium">{e.nombre}</span> <span className="text-tinta-suave">· {e.personas} · llegó {e.llegada}</span>
              </span>
              <span className="cifra rounded-full bg-maiz-claro px-2 py-0.5 text-xs font-semibold text-maiz">
                {e.estimacionMin === null ? "+3 h" : `~${e.estimacionMin} min`}
              </span>
              <Boton suave onClick={() => accion({ accion: "retirar_espera", id: e.id })}>Se fue</Boton>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Actividad({ vista }: { vista: VistaSala }) {
  return (
    <div className="rounded-2xl border border-borde bg-crema p-4">
      <h2 className="mb-2 text-lg">Actividad</h2>
      {vista.eventos.length === 0 ? (
        <p className="text-sm text-tinta-suave">Aquí verás lo que pasa en la sala. Prueba a reservar o a avanzar el reloj.</p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm" aria-live="polite">
          {vista.eventos.map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="cifra text-xs text-tinta-suave">{e.hora}</span>
              <span>{e.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PedirClave({ alEnviar }: { alEnviar: (c: string) => void }) {
  const [valor, setValor] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); alEnviar(valor); }} className="mx-auto max-w-sm space-y-3 rounded-2xl border border-borde bg-crema p-6">
      <h2 className="text-xl">Acceso del personal</h2>
      <label className="block text-sm">
        <span>Clave de la sala</span>
        <input type="password" required value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1 w-full rounded-xl border border-borde bg-white px-3 py-2" autoComplete="current-password" />
      </label>
      <button className="w-full rounded-full bg-tinta py-2 font-semibold text-crema">Entrar</button>
    </form>
  );
}
