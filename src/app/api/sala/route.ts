import { z } from "zod";
import { conEstado, leerEstado, reiniciarDemo } from "@/mesa/almacen";
import { restaurante as cfg } from "@/mesa/config";
import { excedeLimite, respuestaError } from "@/mesa/http";
import * as motor from "@/mesa/motor";
import { accesoPersonal, modoDemo } from "@/mesa/seguridad";
import { vistaSala } from "@/mesa/vista";

export const dynamic = "force-dynamic";

const noAutorizado = () => Response.json({ error: "Clave de personal incorrecta." }, { status: 401 });

/** Panel de sala: solo personal (en modo demo, abierto). */
export function GET(req: Request) {
  const limite = excedeLimite(req, "sala", 120);
  if (limite) return limite;
  if (!accesoPersonal(req)) return noAutorizado();
  return Response.json(vistaSala(leerEstado(), cfg, modoDemo()));
}

const Id = z.string().min(1).max(40);
const Accion = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("sentar"), id: Id }),
  z.object({ accion: z.literal("liberar"), id: Id }),
  z.object({ accion: z.literal("cancelar"), id: Id }),
  z.object({ accion: z.literal("retirar_espera"), id: Id }),
  z.object({ accion: z.literal("sin_reserva"), nombre: z.string().trim().max(60), personas: z.number().int().min(1).max(50) }),
  z.object({
    accion: z.literal("reserva_personal"),
    nombre: z.string().trim().min(2).max(60),
    telefono: z.string().trim().max(25),
    personas: z.number().int().min(1).max(50),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hora: z.string().regex(/^\d{2}:\d{2}$/),
    notas: z.string().trim().max(200).optional(),
  }),
  z.object({ accion: z.literal("avanzar_reloj"), minutos: z.number().int().min(5).max(120) }),
  z.object({ accion: z.literal("reiniciar") }),
]);

export async function POST(req: Request) {
  const limite = excedeLimite(req, "sala-accion", 60);
  if (limite) return limite;
  if (!accesoPersonal(req)) return noAutorizado();
  const cuerpo = Accion.safeParse(await req.json().catch(() => null));
  if (!cuerpo.success) return Response.json({ error: "Acción no válida." }, { status: 400 });
  const a = cuerpo.data;
  // El reloj simulado y el reinicio solo existen en la demo.
  if ((a.accion === "avanzar_reloj" || a.accion === "reiniciar") && !modoDemo()) {
    return Response.json({ error: "Solo disponible en modo demo." }, { status: 403 });
  }
  try {
    let aviso: string | undefined;
    if (a.accion === "reiniciar") reiniciarDemo();
    else
      conEstado((e) => {
        const ahora = e.reloj;
        switch (a.accion) {
          case "sentar": motor.sentar(e, cfg, ahora, a.id); break;
          case "liberar": motor.liberar(e, cfg, ahora, a.id); break;
          case "cancelar": motor.cancelar(e, cfg, ahora, a.id); break;
          case "retirar_espera": motor.retirarDeEspera(e, a.id); break;
          case "avanzar_reloj": motor.avanzarReloj(e, cfg, a.minutos); break;
          case "reserva_personal": {
            const { accion: _, ...d } = a;
            const r = motor.reservar(e, cfg, ahora, { ...d, origen: "personal" });
            aviso = `Reserva anotada: ${r.nombre}, ${r.personas} a las ${r.hora} (${motor.nombresMesas(cfg, r.mesaIds)}).`;
            break;
          }
          case "sin_reserva": {
            const res = motor.llegaSinReserva(e, cfg, ahora, { nombre: a.nombre, personas: a.personas });
            aviso =
              res.tipo === "sentado"
                ? `Pasan a ${motor.laMesa(cfg, res.reserva.mesaIds)}.`
                : res.estimacionMin === null
                  ? "No hay mesa en las próximas 3 horas. Quedan en lista de espera."
                  : `Sin mesa ahora. Espera estimada: ${res.estimacionMin} min.`;
            break;
          }
        }
      });
    return Response.json({ aviso, vista: vistaSala(leerEstado(), cfg, modoDemo()) });
  } catch (e) {
    return respuestaError(e);
  }
}
