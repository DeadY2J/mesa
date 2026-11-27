# Presupuesto · Mesa

Plantilla de la fase 5 de la Fábrica. Las tarifas se dejan sin rellenar a propósito:
**[TARIFA_HORA_USD]** y **[CUOTA_MENSUAL_USD]** los fija Jorge para cada cliente.
Horas estimadas a partir de `ALCANCE.md`; cifras de referencia, no un compromiso.

## 1. Cliente propio

### Implantación
| Bloque | Horas | Importe (USD) |
|---|---|---|
| Adaptación a su restaurante: mesas, plano, horarios, reglas (`config.ts`) | 3 | 3 × [TARIFA_HORA_USD] |
| Supabase: persistencia, RLS por restaurante, reservas sin solapes en la base de datos | 8 | 8 × [TARIFA_HORA_USD] |
| Inicio de sesión del personal | 4 | 4 × [TARIFA_HORA_USD] |
| Despliegue (Vercel), dominio y página de reservas con su marca | 3 | 3 × [TARIFA_HORA_USD] |
| Formación al personal (1 sesión) y puesta en marcha | 2 | 2 × [TARIFA_HORA_USD] |
| **Subtotal base** | **20** | **20 × [TARIFA_HORA_USD]** |

### Integraciones opcionales
| Integración | Horas | Importe (USD) |
|---|---|---|
| Recordatorio y confirmación por WhatsApp (módulo de Recepción 24/7) | 8 | 8 × [TARIFA_HORA_USD] |
| Anticipo con Mercado Pago para grupos o fechas especiales | 6 | 6 × [TARIFA_HORA_USD] |
| Menú QR con asistente IA | 16 | 16 × [TARIFA_HORA_USD] |

Costes de terceros que paga el cliente (no incluidos): WhatsApp Cloud API por conversación, comisión de Mercado Pago,
dominio y, si se supera el plan gratuito, Supabase y Vercel.

### Mantenimiento mensual
**[CUOTA_MENSUAL_USD] / mes**: alojamiento gestionado, copias de seguridad, actualizaciones de seguridad,
cambios menores de configuración (mesas, horarios) y soporte por WhatsApp en horario laboral.

### Total
- Implantación: (20 + horas de integraciones elegidas) × [TARIFA_HORA_USD] USD.
- Mantenimiento: [CUOTA_MENSUAL_USD] USD al mes.
- Moneda local: se muestra también en MXN (o la moneda del cliente) con el tipo de cambio del día de la propuesta,
  indicando la fecha y que el precio de referencia es en USD.

### Condiciones propuestas
50 % al aceptar y 50 % a la puesta en marcha. 30 días de garantía sobre defectos.
El código y los datos del restaurante son del cliente.

## 2. Encargo de Kodarvia
El precio lo fija Kodarvia. Antes de postularse, comparar el pago con **20 h** (base) más las integraciones que pidan,
con un margen del 25 % para imprevistos y revisiones. Si el pago entre las horas estimadas queda por debajo de
[TARIFA_HORA_USD], no compensa. Recordatorio del acuerdo: cesión total del código, 30 días de garantía y no captar al
cliente final durante 12 meses; la base de la Fábrica debe seguir siendo reutilizable (no ceder los módulos genéricos).

## 3. Riesgos que afectan al precio
- Restaurantes con varios locales o servicios que cruzan la medianoche: no cubiertos en el MVP (+6 a 10 h).
- Integración con un TPV o sistema de caja existente: fuera de alcance; presupuestar aparte tras verlo.
