# Estado · Mesa

Actualizado: 27/11/2026.

## Test de humo con Playwright (28/11/2026)
- `npm run test:e2e` compila, arranca la app en modo demo y recorre en Chromium: portada con CSP y las 12 mesas,
  sentar una mesa desde su ficha, reserva desde el teléfono, móvil sin desbordamiento y modo presentación.
  Falla si hay cualquier error de consola. También corre en la CI (trabajo `humo`).
- Encontró y corrigió un fallo real: el patrón del teléfono no era una expresión válida con el modo `v` de los
  navegadores actuales, así que la validación se ignoraba en silencio.

## Modo presentación (28/11/2026)
- Botón "Ver la demo" en la cabecera (solo en modo demo): reinicia la sala y ejecuta solo el guion de 60 s de
  PROSPECCION.md con subtítulos grandes para grabar el vídeo: el teléfono se rellena y reserva para 2 a las 21:15,
  llega un grupo de 4 sin reserva (espera estimada 70 min), +15 min, Daniel Ruiz no llegó y el grupo pasa a la mesa 4,
  y se resaltan las métricas. Botones Repetir, Reiniciar demo y Salir. En móvil cambia sola de pestaña.
- El guion vive en `src/mesa/guion.ts` (puro) con tests: cubre 0–60 s, la voz coincide con PROSPECCION.md y el motor
  cumple el guion con los datos de la demo. 65 tests en verde.

## Rediseño visual del 28/11/2026
- Identidad propia: un comedor de noche visto desde arriba. Fondo vino oscuro, manteles de lino, mesas libres en oliva,
  ocupadas en vino y las que esperan a sus clientes en latón. Tipografías Young Serif (rótulos, horas y números de mesa)
  e Instrument Sans (texto), alojadas en el proyecto.
- El plano es la interfaz principal: cada mesa se dibuja con sus sillas (las ocupadas se rellenan con las personas reales,
  repartidas en las mesas unidas), terraza con macetas, barra y entrada. Al tocar una mesa aparece su ficha con la acción
  principal ("Ya llegaron, sentar" o "Pagaron, liberar mesa"). La mesa que cambia se enciende como una vela.
- La reserva del cliente se ve dentro de un teléfono junto al plano; libro de reservas del día en papel de carta.
- Responsive sin desbordamiento a 390 px, foco visible en latón, `prefers-reduced-motion` respetado, axe sin incidencias
  (escritorio y móvil). 59 tests, typecheck y build en verde.

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
