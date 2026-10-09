# Integraciones

La carpeta `integrations` contiene contratos, no credenciales ni endpoints inventados.

## Implementado

- `PaymentProvider`, `MockPaymentProvider` y `FlowPaymentProvider` (construido sólo
  desde developers.flow.cl: firma HMAC-SHA256, `payment/create`, `payment/getStatus`).
- Webhook de confirmación de Flow (`app/api/webhooks/flow/route.ts`): Flow no firma
  la notificación, sólo envía un `token`; la verificación real es volver a consultar
  `payment/getStatus` con una petición propia firmada antes de llamar a
  `process_payment_event_transaction`. Idempotente por `(provider, external_event_id)`.
- `SecretStore` e implementación efímera de desarrollo.
- Esquema omnicanal preparado para ids externos e idempotencia.
- Base de WhatsApp Cloud API: botón público configurable, webhook con handshake y
  validación HMAC, persistencia idempotente, calificación determinista con
  consentimiento, creación de lead, derivación humana y bandeja operativa con
  historial, asignación, cierre y respuesta manual auditada. El mismo webhook
  actualiza estados de envío, entrega, lectura o falla; una falla deriva la
  conversación a atención humana. Permanece apagada hasta conectar Meta — ver
  [WHATSAPP_GO_LIVE.md](WHATSAPP_GO_LIVE.md).

Falta sólo lo no técnico (dominio, RUT, cuenta de comercio) para activar Flow en
producción — ver [PAYMENTS_GO_LIVE.md](PAYMENTS_GO_LIVE.md).

## Próximos adaptadores

- Mercado Pago: no implementado (`createPaymentProvider()` lanza un error explícito
  si se selecciona). Construirlo sólo desde documentación oficial vigente cuando se
  decida ofrecerlo como alternativa a Flow.
- Email: `EmailProvider`, plantillas versionadas y adaptador Resend/SES/SendGrid.
- Instagram Messaging API oficial después de estabilizar el piloto de WhatsApp.

Cada webhook deberá validar firma, limitar tamaño, normalizar payload, deduplicar por id externo, redactar logs y registrar auditoría.
