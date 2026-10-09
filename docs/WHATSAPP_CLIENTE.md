# Conectar el WhatsApp de un cliente (número propio, portafolio del cliente)

Guía para pasar el número de WhatsApp Business de un cliente a la API de WhatsApp (Cloud API) y atenderlo
desde el panel de su edición con su vendedora virtual. Primer caso: Comercializadora Secos
(`distribuidorasecos`). Complementa `WHATSAPP_GO_LIVE.md` (cómo funciona el webhook y las protecciones).

## Decisiones tomadas (8-10-2026)

- **Se migra el número actual** del cliente. Con la conexión directa (sin un partner certificado de Meta) el
  número **deja de funcionar en la app WhatsApp Business del celular**: se atiende desde `/admin/conversations`
  (vendedora virtual + equipo). Las conversaciones antiguas **no** se traspasan. La "coexistencia" (app y API
  a la vez) sólo está disponible vía Embedded Signup de un Tech Provider o Solution Partner.
- **Todo queda en el portafolio de Meta del cliente** (cuenta de WhatsApp, número y app de Meta). ImpulsIA
  entra como socio. Se usa una **app de Meta propia del cliente**: así el webhook apunta a su dominio y no
  depende de que la app de ImpulsIA tenga acceso avanzado aprobado por Meta.

## Antes de empezar (con el cliente)

1. **Respaldar los chats** en la app WhatsApp Business del celular: Ajustes → Chats → Copia de seguridad
   (Google Drive) y, de los clientes importantes, Exportar chat. Anotar el mensaje de bienvenida, las
   respuestas rápidas y el catálogo si los usan.
2. **Tener el chip a mano**: Meta manda un código por SMS o llamada a ese número.
3. **Elegir un horario de poco movimiento** (la migración deja el número sin recibir mensajes unos minutos
   a un par de horas) y avisar en estados o redes si conviene.
4. **Tarjeta para Meta**: desde octubre de 2026 Meta cobra los mensajes de servicio (aprox. USD 0,02 por
   respuesta en Chile). La paga el cliente en su cuenta de WhatsApp.

## 1. Portafolio del cliente y acceso para ImpulsIA

1. El dueño entra a <https://business.facebook.com> con su Facebook y crea el portafolio a nombre de la
   empresa (o usa el que ya tiene: el de su página de Facebook o Instagram).
2. Configuración → **Socios** → Agregar → "Dar acceso a tus activos a un socio" → ID del portafolio de
   ImpulsIA **1797202634953920**. Por ahora no hay activos que compartir: se comparten en el paso 3.
3. Opcional pero recomendado: Configuración → Personas → invitar a Martín como administrador, para resolver
   problemas sin depender del dueño.

## 2. App de Meta del cliente

1. <https://developers.facebook.com/apps> → Crear app → caso de uso **"Conectar con clientes por WhatsApp"**
   → nombre (ej.: "Secos Ventas") → portafolio: el del cliente.
2. Se crea una cuenta de WhatsApp de prueba; no se usa.
3. Configuración de la app → Básica: **URL de política de privacidad** `https://<dominio>/privacidad`,
   categoría y logo. Copiar el **App ID** y la **Clave secreta de la app** (App Secret) → ver paso 5.
4. Publicar la app (modo "Activo"). Si pide verificación del negocio, se puede seguir en desarrollo para
   probar con números de prueba; para clientes reales hay que publicarla.

## 3. Migrar el número

1. En el celular: WhatsApp Business → Ajustes → Cuenta → **Eliminar mi cuenta** (con el número). Esto
   libera el número para la API. *(Antes: respaldo del paso previo.)*
2. En la app de Meta → WhatsApp → **Configuración de la API** → "Agregar número de teléfono" → crear la cuenta
   de WhatsApp Business **en el portafolio del cliente** → nombre visible (el de la marca; Meta lo revisa) →
   categoría → número → código por SMS o llamada.
3. Copiar el **Identificador del número de teléfono** (phone number ID) y el **Identificador de la cuenta de
   WhatsApp Business** (WABA ID).
4. WhatsApp Manager → la cuenta → **Método de pago**: agregar la tarjeta del cliente.

## 4. Token permanente

1. Configuración del portafolio → Usuarios → **Usuarios del sistema** → Agregar (nombre en minúsculas, ej.
   `secos-bot`, rol Administrador).
2. Asignar activos: la **app** (control total) y la **cuenta de WhatsApp** (control total).
3. Generar token → app del cliente → caducidad **Nunca** → permisos `whatsapp_business_messaging` y
   `whatsapp_business_management` → copiar el token (se muestra una sola vez).

## 5. Secretos de la edición (los pega el usuario; nunca por chat)

En `.impulsia-secrets/<slug>.env`:

```text
NEXT_PUBLIC_WHATSAPP_NUMBER=56XXXXXXXXX        # código país + número, sólo dígitos (botón del sitio)
WHATSAPP_VERIFY_TOKEN=<texto aleatorio de 32+ caracteres que tú inventas>
WHATSAPP_APP_SECRET=<clave secreta de la app del cliente>
WHATSAPP_ACCESS_TOKEN=<token permanente del usuario del sistema>
WHATSAPP_PHONE_NUMBER_ID=<phone number ID>
WHATSAPP_BUSINESS_ACCOUNT_ID=<WABA ID>
WHATSAPP_GRAPH_VERSION=v26.0
```

Para el verify token: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.

Luego: `provision:apply --phase environment` y `--phase deploy` (con `VERCEL_CLI_PATH`).
El bot sigue apagado (`whatsappBotEnabled: false`): primero se prueba la conexión.

## 6. Webhook

App del cliente → WhatsApp → **Configuración** → Webhook → Editar:

- URL de devolución de llamada: `https://<dominio>/api/webhooks/whatsapp`
- Token de verificación: el mismo `WHATSAPP_VERIFY_TOKEN`
- Verificar y guardar → en "Campos del webhook" suscribir **messages**.

## 7. Registrar el número y probar

1. Panel de la edición → **Conversaciones → "Activar número"** → elegir un PIN de 6 dígitos (verificación en
   dos pasos; guardarlo). Debe quedar CONNECTED.
2. Desde otro celular escribir al número: el mensaje debe aparecer en `/admin/conversations` (aún sin
   respuesta automática). Responder a mano desde el panel y ver que llegue.
3. Encender la vendedora: `providers.whatsappBotEnabled: true` en `editions/<slug>/deployment.json` →
   `--phase environment` → `--phase deploy`. Probar: pregunta de precio, cotización, pedir hablar con una
   persona, un audio y una foto.

## Si algo falla

- El webhook no verifica → el verify token no coincide o la edición no se redesplegó con él.
- Llegan mensajes pero no hay respuesta → `WHATSAPP_BOT_ENABLED`, saldo de Anthropic o el log
  `web_chat.failed`/`whatsapp.*` en Vercel (`vercel logs <deployment> --no-follow`).
- Error 401/403 al enviar → token sin la cuenta de WhatsApp asignada o sin los dos permisos.
- Volver atrás: el número se puede eliminar de la API (WhatsApp Manager → Eliminar número) y reinstalar la
  app WhatsApp Business en el celular con el mismo número (se restaura el respaldo de Drive).

Fuentes: documentación de Meta sobre [coexistencia con la app WhatsApp Business](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
(requiere Tech Provider o Solution Partner) y [webhooks](https://developers.secure.facebook.com/docs/whatsapp/cloud-api/webhooks/override).
