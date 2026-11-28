# Auditoría · Mesa

Fecha: 27/11/2026 · Alcance: repositorio `mesa` (Next.js 16, almacén en memoria, sin integraciones externas).
Metodología: revisión de código de todas las rutas API y del motor, más comprobaciones ejecutadas
(typecheck, tests, build, `npm audit`, cabeceras y límite de peticiones contra `next start`, contraste de colores calculado,
capturas con Playwright a 1440 px y 390 px).

## Resultado

Sin fallos críticos ni altos abiertos. Un hallazgo medio de accesibilidad (contraste) se corrigió en esta pasada.
Quedan puntos medios y bajos documentados abajo; ninguno bloquea la demo.

## Seguridad

| # | Gravedad | Hallazgo | Estado |
|---|----------|----------|--------|
| S1 | Alta (prevenida) | Un cliente podría ver o cancelar reservas ajenas si se identificaran por id secuencial. | **Prevenido desde el diseño**: el cliente solo usa un código `crypto.randomUUID()`, validado como UUID; la respuesta pública no incluye teléfono, mesas ni datos de otros. Tests en `tests/api.test.ts`. |
| S2 | Alta (prevenida) | El panel de sala expone nombres y teléfonos y permite cancelar reservas. | **Prevenido**: con `MESA_TOKEN` el panel exige la cabecera `x-mesa-clave`, comparada en tiempo constante (`timingSafeEqual` sobre SHA-256). El reloj simulado y el reinicio devuelven 403 fuera del modo demo. Tests incluidos. |
| S3 | Media | En modo demo (sin `MESA_TOKEN`) el panel es público: cualquiera puede ver los datos ficticios y tocar la sala. | Aceptado: son datos ficticios. **No desplegar con datos reales sin `MESA_TOKEN`.** |
| S4 | Media | El límite de peticiones usa `x-forwarded-for`, que un atacante puede falsear fuera de un proxy de confianza (Vercel lo sobrescribe). Además es en memoria, por instancia. | Abierto: en producción, límite compartido (Upstash/Redis) y IP del proxy. Verificado: la petición 11 a `/api/reservas` en un minuto devuelve 429. |
| S5 | Media | Reservas en línea sin verificación del teléfono: alguien podría llenar el salón con reservas falsas (dentro del límite de 10/min por IP). | Abierto (fase 2): confirmación por WhatsApp con el módulo de Recepción 24/7 y captcha o anticipo en fechas de alta demanda. |
| S6 | Media | CSP completa (`script-src`/`style-src`) sin aplicar: Next.js necesita nonces para scripts en línea. | Abierto, igual que en Recepción 24/7. |
| S7 | Baja | La clave del personal se guarda en `sessionStorage` del navegador. | Aceptado para el MVP; con Supabase se sustituye por inicio de sesión con cookie `httpOnly`. |
| S8 | Baja | Estado en memoria sin tope de reservas: mitigado por el límite de peticiones y por los topes del motor (mesas, llegadas por intervalo). | Se resuelve al pasar a Supabase. |

Comprobado sin hallazgos:
- **Validación de entradas**: Zod en todas las rutas (nombre 2–60, teléfono con patrón, personas 1–50, fecha y hora con formato, notas ≤ 200, acciones de sala como unión discriminada). JSON inválido → 400. Las reglas de negocio se validan además en el motor.
- **Errores**: los de negocio salen como 400 con un mensaje para el usuario; cualquier otro, 500 genérico sin detalles internos.
- **Secretos**: ninguno en el código; `.env.example` sin valores; `.gitignore` excluye `.env` y `.env*.local`.
- **Cabeceras**: nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, HSTS, CSP mínima y sin `X-Powered-By` (verificado con `curl -I`).
- **Dependencias**: `npm audit` → 0 vulnerabilidades. Sin dependencias de IA ni de pagos.

## Calidad

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm test` | OK · 52 tests (motor 25, API 6, seguridad 4, español neutro 17) |
| `npm run build` | OK |
| CI | `.github/workflows/ci.yml` (typecheck, test, build) en cada PR y en `main`. |
| Integridad del motor | Test que verifica que ninguna mesa tiene dos reservas que se pisen (incluida la limpieza) tras 40 reservas variadas y en los datos de la demo. |
| Textos | `tests/neutro.test.ts` recorre todos los literales de `src/` buscando voseo y regionalismos ("turno", "seña", "mesero", "mozo", "che", "acá"…). |
| Accesibilidad (revisión + contraste calculado) | `lang="es"`, etiquetas en todos los campos, `aria-label` descriptivo en cada mesa del plano, `aria-pressed` en selectores, `role="alert"`/`aria-live` en avisos y actividad, foco visible, `prefers-reduced-motion`. **Corregido**: el texto ámbar ("Llega pronto", "Confirmada") tenía contraste 2,8:1; ahora 4,9:1. Todos los pares de color de estado ≥ 4,5:1. **No medido**: Lighthouse/axe y lector de pantalla real. |
| Móvil | Pestañas "Reserva en línea / Sala en vivo" por debajo de `lg`. Sin desbordamiento horizontal a 390 px (comprobado con Playwright); el plano tiene desplazamiento propio. Sin probar en dispositivo real. |
| Rendimiento | Sin medir con Lighthouse. Fuente local (sin Google Fonts). El panel consulta cada 3 s y la estimación de espera simula la cola (coste bajo: decenas de mesas); en producción, SSE o Supabase Realtime. |

## Pendiente antes de producción real
1. Supabase con RLS por restaurante y restricción de exclusión para que dos reservas no tomen la misma mesa a la vez (S8 y concurrencia).
2. Inicio de sesión del personal con cookie `httpOnly` (S2, S7).
3. Límite de peticiones compartido (S4) y confirmación por WhatsApp (S5).
4. CSP con nonces (S6), Lighthouse/axe y prueba en móvil real.
