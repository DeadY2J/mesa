import { beforeEach, describe, expect, it } from "vitest";
import { GET as disponibilidad } from "@/app/api/disponibilidad/route";
import { POST as reservar } from "@/app/api/reservas/route";
import { DELETE as cancelar, GET as consultar } from "@/app/api/reservas/[codigo]/route";
import { GET as sala, POST as accionSala } from "@/app/api/sala/route";
import { reiniciarDemo } from "@/mesa/almacen";
import { reiniciarLimites } from "@/mesa/seguridad";

const json = (url: string, cuerpo: unknown, method = "POST") =>
  new Request(`http://local${url}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
const ctx = (codigo: string) => ({ params: Promise.resolve({ codigo }) });

describe("API", () => {
  beforeEach(() => {
    reiniciarLimites();
    reiniciarDemo();
    delete process.env.MESA_TOKEN;
  });

  it("reserva en línea: el cliente recibe su código y no ve datos de otros", async () => {
    const disp = await (await disponibilidad(new Request("http://local/api/disponibilidad?personas=2"))).json();
    expect(disp.horas.length).toBeGreaterThan(0);
    expect(JSON.stringify(disp)).not.toMatch(/\+52 55 1000/);
    const res = await reservar(json("/api/reservas", { nombre: "Laura Gómez", telefono: "+52 55 9999 0000", personas: 2, fecha: disp.fecha, hora: disp.horas[0].hora }));
    expect(res.status).toBe(201);
    const r = await res.json();
    expect(r.codigo).toMatch(/^[0-9a-f-]{36}$/);
    expect(r).not.toHaveProperty("telefono");
    expect(r).not.toHaveProperty("mesaIds");
    expect((await consultar(new Request("http://local"), ctx(r.codigo))).status).toBe(200);
    const c = await (await cancelar(new Request("http://local", { method: "DELETE" }), ctx(r.codigo))).json();
    expect(c.estado).toBe("cancelada");
  });

  it("rechaza datos no válidos y códigos inventados", async () => {
    expect((await reservar(json("/api/reservas", { nombre: "X", telefono: "abc", personas: 2 }))).status).toBe(400);
    expect((await reservar(new Request("http://local/api/reservas", { method: "POST", body: "no es json" }))).status).toBe(400);
    expect((await consultar(new Request("http://local"), ctx("res_1"))).status).toBe(404);
    expect((await consultar(new Request("http://local"), ctx(crypto.randomUUID()))).status).toBe(404);
  });

  it("las reglas del motor llegan como 400 con mensaje legible", async () => {
    const res = await reservar(json("/api/reservas", { nombre: "Grupo", telefono: "+52 55 9999 0000", personas: 12, fecha: "2026-11-28", hora: "20:00" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/llámanos/);
  });

  it("con MESA_TOKEN la sala pide clave y no deja tocar el reloj ni reiniciar", async () => {
    process.env.MESA_TOKEN = "clave-de-prueba";
    expect((await sala(new Request("http://local/api/sala"))).status).toBe(401);
    const conClave = (cuerpo: unknown) =>
      new Request("http://local/api/sala", { method: "POST", headers: { "content-type": "application/json", "x-mesa-clave": "clave-de-prueba" }, body: JSON.stringify(cuerpo) });
    expect((await accionSala(conClave({ accion: "reiniciar" }))).status).toBe(403);
    expect((await accionSala(conClave({ accion: "avanzar_reloj", minutos: 15 }))).status).toBe(403);
    expect((await sala(new Request("http://local/api/sala", { headers: { "x-mesa-clave": "clave-de-prueba" } }))).status).toBe(200);
  });

  it("limita las reservas en línea por IP", async () => {
    const req = () => json("/api/reservas", { nombre: "Spam", telefono: "+52 55 0000 0000", personas: 2, fecha: "2026-11-28", hora: "13:00" });
    let ultimo = 0;
    for (let i = 0; i < 11; i++) ultimo = (await reservar(req())).status;
    expect(ultimo).toBe(429);
  });

  it("guion de la demo por la API: sin reserva → espera → +15 min → sentados", async () => {
    const a = await (await accionSala(json("/api/sala", { accion: "sin_reserva", nombre: "Los Romero", personas: 4 }))).json();
    expect(a.aviso).toMatch(/Espera estimada/);
    const b = await (await accionSala(json("/api/sala", { accion: "avanzar_reloj", minutos: 15 }))).json();
    expect(b.vista.metricas.rescatadosDeEspera).toBe(1);
    expect(b.vista.eventos[0].texto).toMatch(/Los Romero \(4\) pasa a la mesa 4/);
  });
});
