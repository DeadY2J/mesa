# Alcance · Mesa (reservas y gestión de mesas)

Producto 4 de la Fábrica LatAm. Restaurante ficticio de la demo: **La Ceiba, cocina de mercado** (Ciudad de México).
Encargo hecho en modo desatendido: las decisiones tomadas sin preguntar están en la última sección.

## Problema del negocio
Un restaurante pequeño o mediano lleva las reservas en una libreta o por WhatsApp. Consecuencias:
mesas vacías por personas que no llegan, grupos que no caben porque nadie juntó mesas a tiempo,
gente sin reserva que se va porque nadie sabe decirle cuánto tendrá que esperar, y cocina saturada
cuando llegan 30 personas a la misma hora.

## Usuarios
- **Cliente final**: reserva en línea desde el móvil y puede cancelar su propia reserva con su código.
- **Personal de sala (recepción)**: ve el salón en vivo, sienta a quien llega, libera mesas, marca a quien no se presentó
  y gestiona a quien llega sin reserva.
- **Dueño**: configura mesas, horarios y reglas en un solo archivo (`src/mesa/config.ts`).

## MVP (este PR)
1. **Motor puro con tests** (`src/mesa/motor.ts`):
   - Disponibilidad por fecha y número de personas, con servicios (comida y cena), hora de última reserva y duración según el tamaño del grupo.
   - Asignación automática de mesa por mejor ajuste (la mesa más pequeña que sirve) y unión de mesas definidas en la configuración para grupos grandes.
   - Margen de limpieza entre reservas y tope de comensales que llegan en cada intervalo de 15 minutos (protege a la cocina).
   - Ciclo de vida: confirmada → sentada → terminada, o cancelada / no se presentó (tolerancia configurable).
   - Personas sin reserva: se sientan al momento si hay mesa; si no, entran en lista de espera con **tiempo estimado** calculado simulando la cola.
   - Al liberarse una mesa (cuenta pagada, cancelación o ausencia), la lista de espera se atiende sola.
2. **Interfaz de demo** con dos vistas: la reserva en línea del cliente y el panel de sala con el plano del salón en vivo.
3. **Reloj simulado** en modo demo (+15 min) para ver en un vídeo de 60 s cómo se marcan ausencias, se liberan mesas y avanza la espera.
4. Modo demo sin claves, CI (typecheck, tests, build), cabeceras de seguridad, AUDITORIA.md y STATUS.md.

## Momento wow (vídeo de 60 s)
Llega un grupo de 4 sin reserva en plena cena → "Espera estimada: 25 min". Se avanza el reloj: una reserva no llega,
el sistema la marca como ausente y **sienta solo** al grupo en espera; la mesa florece en el plano.

## Fase 2 (fuera de este PR)
- Recordatorio por WhatsApp el día de la reserva con botón de confirmar (módulo WhatsApp de Recepción 24/7).
- Anticipo con Mercado Pago para grupos grandes o fechas especiales.
- Menú QR con asistente IA, pantalla de cocina en tiempo real, dividir la cuenta.
- Supabase con RLS por restaurante, inicio de sesión del personal y varios restaurantes.
- Editor visual del plano del salón.

## Criterios de aceptación
- Nunca se asignan dos reservas a la misma mesa en horarios que se pisan (incluido el margen de limpieza).
- No se aceptan reservas en línea fuera de servicio, en el pasado, con menos de la antelación mínima ni por encima del tope de personas en línea.
- Un grupo que no cabe en ninguna mesa sola recibe una unión de mesas válida; si no hay, no se reserva.
- A los N minutos de tolerancia sin llegar, la reserva pasa a "no se presentó" y la mesa queda libre.
- El cliente solo puede ver y cancelar su propia reserva (código impredecible); el panel de sala exige clave fuera del modo demo.
- `npm run typecheck`, `npm test` y `npm run build` pasan; todos los textos visibles en español neutro con tuteo.

## Riesgos
- **Almacén en memoria**: se pierde al reiniciar y no sirve con varias instancias. Se sustituye por Supabase (fase 2).
- **Reservas concurrentes**: en memoria son atómicas (un solo hilo). Con BD hará falta una restricción de exclusión o transacción.
- **Turnos de mesa reales**: la duración por tamaño de grupo es una estimación; el personal libera la mesa a mano.
- **Husos horarios**: todo se guarda como fecha y hora locales del restaurante (mismo enfoque que Recepción 24/7).
- **Servicios que cruzan la medianoche**: no se soportan en el MVP (el último servicio cierra antes de las 00:00).

## Estimación
| Bloque | Horas |
|---|---|
| Motor y tests | 6 |
| API y seguridad | 3 |
| Interfaz (plano, reserva en línea, panel) | 7 |
| Auditoría, documentación y CI | 2 |
| **Total MVP** | **18 h** |

## Decisiones tomadas sin preguntar (modo desatendido)
1. Restaurante ficticio en Ciudad de México, moneda MXN (sin precios en el MVP: no hacen falta para reservar).
2. Sin IA ni WhatsApp en el MVP: el núcleo es reservas y mesas, como pidió Jorge; los extras quedan en fase 2.
3. Palabras neutras: "personal de sala" (no "mesero", "camarero" ni "mozo"), "sin reserva", "no se presentó", "anticipo".
4. Uniones de mesas explícitas en la configuración (qué mesas se pueden juntar), no calculadas por geometría: más predecible para el dueño.
5. Reloj simulado solo en modo demo; con `MESA_TOKEN` configurado se usa la hora real del restaurante y el reloj y el reinicio se desactivan.
6. Repo vacío: se creó `main` con un README mínimo para poder abrir el PR contra él. Todo el código va en una sola rama y un PR, con commits por parte.
