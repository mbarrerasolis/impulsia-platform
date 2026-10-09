# Ir a producción con pagos reales (Flow)

## Código: listo

- `integrations/payments/flow-payment-provider.ts` implementa `payment/create`,
  `payment/getStatus` y la firma HMAC-SHA256, construidos sólo con la documentación
  oficial (developers.flow.cl). Firma cubierta por
  `integrations/payments/flow-payment-provider.test.ts` contra el ejemplo exacto de
  la documentación.
- `services/workflows/payment-workflow.ts` crea el link de pago en modo Supabase:
  busca el contacto de facturación de la cuenta, llama a Flow, guarda el pago y
  reutiliza el mismo link si ya existía uno para ese período (validado en
  `npm run smoke:billing`).
- `app/api/webhooks/flow/route.ts` recibe la confirmación de Flow (sólo envía un
  `token`, sin firma propia), vuelve a consultar `payment/getStatus` con una
  petición firmada por nosotros —esa es la fuente de verdad, no el POST entrante—
  y llama a `process_payment_event_transaction` de forma idempotente.
- El botón "Crear link de pago" en `/admin/billing` sigue deshabilitado
  ("Proveedor pendiente") mientras `PAYMENT_PROVIDER=mock`.

## Lo que falta, en orden

1. **Dominio propio con HTTPS.** Flow necesita una `urlConfirmation` pública
   (`https://tudominio.cl/api/webhooks/flow`) para poder notificar pagos. No
   funciona contra `localhost`. Define `NEXT_PUBLIC_APP_URL` con ese dominio.
2. **Constitución/RUT de la empresa.** Tanto Flow como Mercado Pago exigen un RUT
   o RUT de persona natural con giro para abrir la cuenta de comercio y poder
   recibir transferencias.
3. **Cuenta de comercio en Flow** (sandbox primero: sandbox.flow.cl/app/web/register.php,
   luego producción: dashboard.flow.cl/register). Desde la pestaña de integración
   se obtienen `apiKey` y `secretKey`.
4. **Completar `.env.local`:**
   ```
   PAYMENT_PROVIDER=flow
   FLOW_API_KEY=...
   FLOW_SECRET_KEY=...
   FLOW_ENVIRONMENT=sandbox   # cambiar a production sólo cuando esté todo validado
   NEXT_PUBLIC_APP_URL=https://tudominio.cl
   ```
5. **Probar contra sandbox primero.** Con `FLOW_ENVIRONMENT=sandbox`, generar un
   link real desde `/admin/billing`, pagarlo con las tarjetas de prueba de Flow y
   confirmar que el webhook marca el período como `paid`.
6. **Recién entonces `FLOW_ENVIRONMENT=production`** con las credenciales de
   producción (distintas a las de sandbox).

## Fuera de alcance por ahora (no bloquea lo anterior)

- El contacto de facturación se marca desde la UI (`/admin/accounts/[id]`, botón
  "Editar" o "Agregar" en Contactos → rol `Facturación` + "Contacto principal de
  facturación"); la conversión de un lead no lo asigna automáticamente. Sin ese
  contacto, `payment-link` responde 409 con un mensaje claro.
- Mercado Pago no tiene adaptador todavía (`createPaymentProvider()` lanza un
  error explícito si se selecciona). Se agrega igual de fácil si se prefiere ese
  proveedor: es una clase más detrás de la misma interfaz `PaymentProvider`.
- Reembolsos: Flow tiene un endpoint separado no cubierto aquí.
