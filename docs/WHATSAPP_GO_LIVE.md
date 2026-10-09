# Activación de WhatsApp Cloud API

La base técnica está implementada, pero permanece apagada hasta conectar una
cuenta oficial de Meta. No uses proveedores no oficiales ni automatización de
WhatsApp Web.

## Preparación en Meta

1. Crear o seleccionar una app de Meta Business y agregar WhatsApp.
2. Vincular la cuenta de WhatsApp Business y el número que atenderá a los leads.
3. Obtener el `phone_number_id`, un token con permisos de mensajería y el App
   Secret. Usar credenciales de sistema/producción, no el token temporal de prueba.
4. En la configuración de webhooks registrar:
   - Callback: `https://<dominio-oficial>/api/webhooks/whatsapp`
   - Verify token: el mismo valor secreto configurado en
     `WHATSAPP_VERIFY_TOKEN`.
   - Suscripción: campo `messages` de la cuenta de WhatsApp Business.
5. Consultar la documentación oficial vigente y elegir explícitamente una versión
   soportada de Graph API. El proyecto no fija una versión por defecto para evitar
   activar accidentalmente una versión obsoleta.

Referencias primarias:

- [Documentación de WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Ejemplos oficiales de Meta](https://github.com/fbsamples/whatsapp-api-examples)

## Variables de Vercel

```text
NEXT_PUBLIC_WHATSAPP_NUMBER=<código país + número, sólo dígitos>
NEXT_PUBLIC_WHATSAPP_MESSAGE=Hola, quiero evaluar una automatización para mi empresa.
WHATSAPP_VERIFY_TOKEN=<secreto elegido para el handshake>
WHATSAPP_APP_SECRET=<App Secret de Meta>
WHATSAPP_ACCESS_TOKEN=<token de sistema/producción>
WHATSAPP_PHONE_NUMBER_ID=<id numérico del número>
WHATSAPP_GRAPH_VERSION=<versión vigente, por ejemplo vNN.0>
WHATSAPP_BOT_ENABLED=false
```

Primero desplegar y verificar el handshake con `WHATSAPP_BOT_ENABLED=false`.
Activar el bot sólo después de enviar y recibir manualmente un mensaje de prueba.

## Flujo programado

1. Recibe mensajes sólo si la firma `X-Hub-Signature-256` coincide con el App
   Secret.
2. Deduplica por identificador externo y guarda canal, conversación y mensaje.
3. Con el bot activo, pregunta necesidad, empresa, email, objetivo y consentimiento.
4. Sólo después de un `SÍ` explícito crea el lead con origen `whatsapp`.
5. Una solicitud de persona/asesor cambia inmediatamente a derivación humana.
6. Si falla el envío automático, la conversación queda marcada para atención
   humana; no se reintenta a ciegas ni se duplican mensajes.
7. Desde la bandeja se puede abrir el historial, asignar un responsable interno,
   responder manualmente y cerrar la conversación. La respuesta queda deshabilitada
   hasta conectar Meta y cada envío manual se registra en la auditoría.
8. Los eventos de estado actualizan cada mensaje como enviado, entregado, leído o
   fallido; los fallos activan la derivación humana para evitar silencios.

## Validación antes de abrir tráfico

- Confirmar que la firma inválida devuelve 401.
- Confirmar que el handshake inválido devuelve 403.
- Confirmar que un mismo `wamid` no se duplica.
- Completar el flujo con consentimiento positivo y revisar el lead en CRM.
- Completar el flujo con `NO` y comprobar que no se crea lead.
- Pedir “hablar con una persona” y revisar la alerta en Conversaciones.
- Definir horario, responsable y SLA de atención humana.

## Asistente comercial con IA

Con `AI_PROVIDER=anthropic` el asistente con IA reemplaza al guion determinista:
conversa en lenguaje natural, da rangos de precio con el motor de precios
(`estimar_precio`), registra leads sólo con autorización explícita
(`registrar_lead`) y deriva a una persona cuando corresponde
(`derivar_a_humano`). Con `AI_PROVIDER=disabled` vuelve el guion.

### Requisitos

1. Aplicar la migración `202609230001_ai_usage_events.sql` (registro de gasto)
   **antes** de activar la IA.
2. Crear una API key en console.anthropic.com, idealmente en un workspace sólo
   para el bot, con créditos prepagados, **sin recarga automática** y con límite
   de gasto mensual.
3. Variables en Vercel:

```text
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=<key del workspace del bot>
AI_MODEL=claude-sonnet-5
AI_DAILY_BUDGET_USD=2
AI_MAX_REPLIES_PER_CONVERSATION_DAY=30
AI_MAX_MESSAGES_PER_SENDER_MINUTE=10
AI_MAX_MESSAGES_PER_SENDER_DAY=50
```

No activar `AI_PROVIDER=anthropic` sin `ANTHROPIC_API_KEY`: la validación de
entorno falla y rompe todo el sitio.

### Protecciones de gasto

- **Techo externo**: créditos prepagados y límite mensual en la consola de Anthropic.
- **Presupuesto de 24 horas** (`AI_DAILY_BUDGET_USD`): al 80% llega un correo a
  contacto@; al 100% la IA deja de responder, contesta un mensaje fijo y deriva
  a una persona hasta que baje el gasto de la ventana móvil.
- **Por contacto**: más de 10 mensajes por minuto se ignoran (quedan guardados);
  más de 50 al día derivan sin responder.
- **Por conversación**: más de 30 respuestas de IA en 24 h deriva a una persona.
- **Por mensaje**: máximo 4 llamadas al modelo (3 rondas de herramientas),
  2.048 tokens de salida, 1.500 caracteres de entrada y 20 mensajes de historial.
- **Interruptor**: `WHATSAPP_BOT_ENABLED=false` apaga todas las respuestas
  automáticas; `AI_PROVIDER=disabled` vuelve al guion determinista.
- Cada respuesta registra tokens y costo estimado en `ai_usage_events`; el
  resumen de gasto aparece en `/admin/conversations`.

### Prueba antes de abrir tráfico

En `/admin/conversations`, el **Laboratorio del asistente** conversa con el
modelo real sin enviar WhatsApp ni crear leads (el gasto sí cuenta en el
presupuesto). Probar al menos: consulta de precios, registro con y sin
autorización, pedido de hablar con una persona, intento de sacar al asistente
de su rol y un mensaje fuera de tema.

## Agenda de reuniones en Google Calendar (opcional)

Con `ASSISTANT_SCHEDULING_ENABLED=true` el asistente de IA ofrece horarios libres del
calendario del equipo y, con el prospecto registrado y su confirmación, crea el evento
con Google Meet e invita al cliente. Sólo consulta disponibilidad (free/busy) y crea
eventos: no lista, edita ni borra eventos existentes. Una reunión por conversación;
cambios y cancelaciones se derivan a una persona. En el laboratorio consulta horarios
reales pero nunca crea eventos.

### Credencial (una vez, con la cuenta `contacto@impulsialabs.cl`)

1. [Google Cloud Console](https://console.cloud.google.com/) → crear un proyecto
   (p. ej. `impulsia-asistente`) → **APIs y servicios → Biblioteca** → habilitar
   **Google Calendar API**.
2. **Pantalla de consentimiento OAuth** → tipo **Interno** (sólo cuentas de
   impulsialabs.cl; así el token no vence a los 7 días) → nombre de la app y correo.
3. **Credenciales → Crear credenciales → ID de cliente OAuth** → tipo **Aplicación
   web** → URI de redirección autorizado: `https://developers.google.com/oauthplayground`.
   Guardar el *Client ID* y el *Client secret*.
4. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) → ícono de
   engranaje → *Use your own OAuth credentials* → pegar Client ID y secret → en
   *Input your own scopes* escribir
   `https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy`
   → **Authorize APIs** con `contacto@impulsialabs.cl` → **Exchange authorization code
   for tokens** → copiar el **Refresh token**.
5. En Vercel (Production): `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`,
   `GOOGLE_CALENDAR_REFRESH_TOKEN` y `ASSISTANT_SCHEDULING_ENABLED=true`. Opcionales
   (con sus valores por defecto): `GOOGLE_CALENDAR_ID=primary`,
   `ASSISTANT_TIME_ZONE=America/Santiago`, `ASSISTANT_BUSINESS_HOURS=09:00-18:00`,
   `ASSISTANT_BUSINESS_DAYS=1,2,3,4,5`, `ASSISTANT_MEETING_MINUTES=30`,
   `ASSISTANT_MEETING_NOTICE_MINUTES=120`, `ASSISTANT_MEETING_HORIZON_DAYS=7`.
6. Redesplegar y probar en el laboratorio: pedir una reunión debe mostrar horarios que
   coincidan con los huecos reales del calendario.

Para revocar el acceso: myaccount.google.com → Seguridad → Apps de terceros, o borrar
el cliente OAuth en Google Cloud. Si el token deja de servir, la herramienta falla y el asistente
no puede agendar (el error queda en los logs como `assistant.tool.failed`); revisa
la credencial o apaga `ASSISTANT_SCHEDULING_ENABLED`.

## Seguimiento automático de conversaciones pausadas

Si el asistente respondió y el cliente no contesta en `ASSISTANT_FOLLOW_UP_MINUTES` (4 por defecto, máximo 4),
la IA le escribe **un** mensaje breve para retomar (agendar la reunión o aclarar dudas). No hay cron: después de
responder, la misma función del webhook espera el plazo (`after()`, `maxDuration = 300` con Fluid Compute) y
revisa la conversación. Reglas en `domain/messaging/follow-up.ts`: sólo conversaciones atendidas por la IA
(`bot_qualifying`/`qualified`), sin reunión agendada, uno por pausa y máximo 2 por conversación. La IA puede
decidir no escribir si la conversación terminó (`NO_ENVIAR`). Los mensajes quedan en `messages` con
`metadata.followUp = true` y su costo en `ai_usage_events`.

- Encendido con `ASSISTANT_FOLLOW_UP_ENABLED=true` (ya en producción); apagar con `false` y redesplegar.
- Costo: cada respuesta del bot mantiene la función viva ~4 minutos (casi sin CPU); revisar el uso en Vercel si
  el volumen crece mucho.
- Logs: `whatsapp.follow_up` (enviado o sin presupuesto) y `whatsapp.follow_up.failed`.
