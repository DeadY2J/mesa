# Estado · Mesa

Actualizado: 27/11/2026.

## Revisión del 28/11/2026 (auditoría fase 4)
- CSP completa con nonce por petición (`src/proxy.ts`), verificada en navegador sin errores.
- Contraste de las etiquetas pequeñas de las mesas corregido (axe sin incidencias).
- Typecheck, 57 tests, build y `npm audit` (0 vulnerabilidades) en verde; axe sin incidencias en la vista inicial; sin desbordamiento a 375 px.
- Pendiente con cuentas reales (no se da por bueno): Supabase, inicio de sesión del personal y confirmación por WhatsApp con cuenta real.
- Detalle en `AUDITORIA.md`. No desplegado.

## Hecho (MVP en modo demo)
- Motor puro con tests: disponibilidad, asignación de mesa por mejor ajuste y uniones, margen de limpieza,
  tope de llegadas por intervalo, ciclo de vida de la reserva, ausencias automáticas, sin reserva y lista de espera
  con tiempo estimado (simulación de la cola) que se atiende sola.
- Interfaz: reserva en línea (vista del cliente) y sala en vivo (plano, reservas de hoy, sin reserva, lista de espera, actividad),
  con reloj simulado (+15 min) y reinicio.
- API validada con Zod, límite de peticiones, `MESA_TOKEN` para el personal, cabeceras de seguridad.
- CI, ALCANCE.md, AUDITORIA.md, README con guion de vídeo de 60 s.
- 52 tests, typecheck y build en verde; `npm audit` sin vulnerabilidades.

## Pendiente
- Supabase (persistencia, RLS, restricción de exclusión por mesa) e inicio de sesión del personal.
- Fase 2: recordatorio y confirmación por WhatsApp, anticipo con Mercado Pago para grupos, menú QR con asistente IA,
  pantalla de cocina, dividir la cuenta, editor visual del plano.
- Lighthouse en Vercel y prueba en un móvil real (axe ya hecho). Grabar el vídeo.
- Sin desplegar (no se pidió).

## Cómo probarlo
```bash
npm install
npm run dev     # http://localhost:3000
npm test
```
Guion rápido: en "Sala en vivo", "Llega gente sin reserva" con 4 personas → lista de espera con tiempo estimado →
**+15 min** → Daniel Ruiz no llegó y el grupo pasa solo a la mesa 4. En "Reserva en línea", reserva y mira cómo se enciende la mesa.
