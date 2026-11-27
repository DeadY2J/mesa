# Fábrica · Mesa

Proyecto de Jorge Lamelas: producto 4 de la Fábrica de software para pymes de Latinoamérica.
Reservas en línea y gestión de mesas en vivo para restaurantes. Restaurante ficticio de la demo: La Ceiba (Ciudad de México).
Alcance en `ALCANCE.md`, estado en `STATUS.md`.

## Comandos
- `npm run dev`: servidor en http://localhost:3000 (sin variables funciona el modo demo).
- `npm test`: tests (Vitest). Deben pasar siempre antes de commitear.
- `npm run typecheck` y `npm run build`: los ejecuta también la CI.

## Arquitectura (respétala)
- `src/mesa/config.ts`: lo ÚNICO que cambia por restaurante (mesas, uniones, horarios, duración, tolerancia, topes).
- `src/mesa/motor.ts`: motor puro y testeable (disponibilidad, asignación de mesa, ciclo de vida, ausencias, lista de espera y su estimación).
- `src/mesa/semilla.ts`: datos ficticios de la demo, preparados para el guion del vídeo.
- `src/mesa/almacen.ts`: estado en memoria. Para producción se sustituye por Supabase sin tocar el motor.
- `src/mesa/vista.ts`: lo que viaja al navegador. El cliente solo ve SU reserva; el personal ve la sala.
- `src/mesa/seguridad.ts`: `MESA_TOKEN` (clave del personal), modo demo y límite de peticiones.
- `src/app/`: interfaz (`mesa-demo.tsx`) y rutas API (`api/disponibilidad`, `api/reservas`, `api/reservas/[codigo]`, `api/sala`).

## Convenciones
- Código y comentarios en español. Todos los textos visibles en español latinoamericano neutro con tuteo:
  sin voseo ni modismos regionales ("personal de sala", no "mesero", "camarero" ni "mozo"; "cita", no "turno"; "anticipo", no "seña").
  `tests/neutro.test.ts` lo comprueba en todos los archivos de `src/`.
- Toda regla de negocio nueva va en el motor con su test, no en la UI ni en la API.
- Un cliente solo puede ver y cancelar su propia reserva (código impredecible `crypto.randomUUID()`).
- Ningún secreto en el código. El reloj simulado y el reinicio solo existen en modo demo.
