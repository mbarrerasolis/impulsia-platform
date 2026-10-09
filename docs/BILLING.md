# Billing y cobranza

## Estado actual

Existe el modelo SQL, reglas de transición, abstracción `PaymentProvider`, proveedor mock, generación de períodos y calendario de recordatorios. El flujo demo permite crear el link, aprobar el pago, cancelar recordatorios y verificar idempotencia.

El adaptador real de Flow (`integrations/payments/flow-payment-provider.ts`) y su webhook (`app/api/webhooks/flow/route.ts`) ya están construidos contra la documentación oficial y probados: firma HMAC-SHA256 (`flow-payment-provider.test.ts`) y el flujo de creación/reuso de link contra Supabase (`npm run smoke:billing`). Falta únicamente lo no técnico para activarlo — ver [PAYMENTS_GO_LIVE.md](PAYMENTS_GO_LIVE.md). Los jobs de recordatorios automáticos (envío real por email/WhatsApp) siguen en Fase 2.

## Flujo seguro objetivo

1. El servidor genera un período desde items activos y guarda el snapshot.
2. El servidor crea el link con el proveedor por el monto persistido.
3. El webhook verifica firma, registra `payment_events` con clave única y normaliza el evento.
4. Una transición válida actualiza pago y período dentro de una transacción.
5. Al aprobarse, se cancelan recordatorios futuros y se registra auditoría.

El navegador no puede marcar pagos aprobados. Las tablas de eventos no exponen escritura por RLS.

## Recordatorios

Offsets iniciales respecto del vencimiento: -5, -1, 0, +3, +7 y +15 días. El último crea una alerta manual. El destinatario debe ser un contacto `billing` activo, priorizando `is_primary_billing`.
