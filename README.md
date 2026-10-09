# ImpulsIA Platform

Plataforma de ventas configurable por cliente: **portal público + CRM + asistente de IA en WhatsApp y web**, para negocios B2B o B2C que venden servicios o productos. Una misma base de código se despliega como "ediciones" aisladas por cliente (marca, catálogo, reglas comerciales, Vercel y Supabase propios).

**En producción:**
- [impulsialabs.cl](https://impulsialabs.cl): edición de ImpulsIA (servicios B2B: diagnóstico, cotización, agendamiento y asistente comercial).
- [distribuidorasecos.cl](https://distribuidorasecos.cl): edición de **Comercializadora Secos** (tienda de frutos secos al detalle y mayorista, precios por tramo, armador de mix y pedidos al CRM).

## Qué incluye

- **Asistente de ventas con Claude** en WhatsApp Cloud API, Instagram DM y chat web: califica leads, usa herramientas (catálogo, cálculo de impacto, pedidos, agenda), entiende fotos/PDF y notas de voz.
- **CRM**: leads con atribución UTM, conversión a cuentas y contactos, conversaciones con intervención humana, seguimientos automáticos.
- **Comercial**: cotizador con reglas de precio versionadas y recalculadas en servidor, ventas, inventario, cobros (Flow) y reseñas moderadas.
- **Marketing**: Meta Pixel + Conversions API con consentimiento, sincronización de gasto de Meta Ads y reportes de costo por lead.
- **Agendamiento** en Google Calendar y correos transaccionales con Resend.
- **Ediciones y aprovisionamiento**: scripts que crean y validan la infraestructura de un cliente nuevo (Vercel, Supabase, variables y dominio).

## Stack

Next.js (App Router) · TypeScript · Supabase (PostgreSQL + RLS + Auth) · Vercel · API de Claude · WhatsApp Cloud API · Resend · Vitest · GitHub Actions

## Calidad

Monolito modular con dominio puro separado de React y Supabase ([arquitectura](docs/ARCHITECTURE.md)). 62 archivos de test / 337 tests con Vitest; CI con lint, typecheck, tests y build. Políticas RLS versionadas en `supabase/migrations`.

> Desarrollado por [Martín Barrera Solis](https://impulsialabs.cl) trabajando con agentes de IA (Claude Code y Codex); `AGENTS.md` contiene las convenciones compartidas por ambos.
>
> Esta es una copia de portafolio: se excluyeron documentos internos, material de clientes y marketing; los identificadores de cuentas y datos bancarios fueron reemplazados por valores de ejemplo.


## Requisitos en Windows

- Node.js 24 o superior (`node --version`)
- Git
- Docker Desktop sólo si usarás Supabase local
- PowerShell. En equipos con scripts de PowerShell restringidos, usa `npm.cmd` como muestran los comandos.

## Inicio rápido (modo demo, sin credenciales)

```powershell
Set-Location .\impulsia-platform
Copy-Item .env.example .env.local
& 'C:\Program Files\nodejs\npm.cmd' install
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

Abre `http://localhost:3000`. Rutas útiles:

- `/` landing pública
- `/diagnostico` captura de leads
- `/admin/dashboard` operación demo
- `/admin/crm` leads creados durante la sesión
- `/admin/crm/[id]` conversión de lead a cuenta/contacto
- `/admin/accounts` cuentas y contactos
- `/admin/quotes/new` cotizador
- `/admin/solutions` soluciones aprobadas
- `/admin/billing` períodos y pagos mock
- `/admin/pricing` reglas vigentes
- `/portal` portal cliente demo

El repositorio en memoria sirve sólo para desarrollo: se reinicia al reiniciar el proceso y no debe usarse en producción.

## Calidad

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run lint
& 'C:\Program Files\nodejs\npm.cmd' run typecheck
& 'C:\Program Files\nodejs\npm.cmd' test
& 'C:\Program Files\nodejs\npm.cmd' run build
```

O todo junto:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run check
```

Con el servidor de desarrollo activo, el flujo HTTP completo se valida con:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run smoke:http
```

## Supabase local

Docker Desktop debe estar iniciado.

```powershell
& 'C:\Program Files\nodejs\npx.cmd' supabase start
& 'C:\Program Files\nodejs\npx.cmd' supabase db reset
& 'C:\Program Files\nodejs\npx.cmd' supabase status
```

Copia URL y publishable/anon key desde `supabase status` a `.env.local`, cambia `APP_MODE=supabase` y reinicia Next.js. Para regenerar tipos:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run db:types
```

## Supabase remoto

Vincula el proyecto y aplica migraciones sólo después de verificar el destino:

```powershell
& 'C:\Program Files\nodejs\npx.cmd' supabase login
& 'C:\Program Files\nodejs\npx.cmd' supabase link --project-ref TU_PROJECT_REF
& 'C:\Program Files\nodejs\npx.cmd' supabase db push --dry-run
& 'C:\Program Files\nodejs\npx.cmd' supabase db push
```

## Variables de entorno

Copia `.env.example` a `.env.local`. Nunca versiones `.env.local`.

- `APP_MODE`: `demo` o `supabase`.
- `NEXT_PUBLIC_APP_URL`: URL pública.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: conexión pública segura de Supabase.
- `SUPABASE_SECRET_KEY`: clave secreta preferida, sólo servidor, para jobs y webhooks confiables.
- `SUPABASE_SERVICE_ROLE_KEY`: compatibilidad con proyectos que aún usan la clave legacy; nunca se expone al navegador.
- El login y las lecturas requieren las variables públicas; el flujo completo de cotización/pagos requiere además una de las claves secretas anteriores.
- `SECRET_STORE_PROVIDER`: `local-memory` en desarrollo; vault/KMS en producción.
- `PAYMENT_PROVIDER`, `EMAIL_PROVIDER`: permanecen en `mock` en esta fase.
- Las variables de Mercado Pago, Flow, Resend, Meta y OpenAI están reservadas y pueden quedar vacías.
- `NEXT_PUBLIC_BRAND_*`: identidad comercial, contacto, propuesta principal y
  colores de una edición replicada. Consulta [Producto replicable](docs/PRODUCTIZATION.md).
- `NEXT_PUBLIC_COMMERCE_*`, `PRICING_*` y `SOLUTION_CATALOG_JSON`: moneda,
  reglas versionadas y plantillas comerciales de cada edición.
- `LANDING_CONTENT_JSON`, `PRODUCT_SHOWCASE_JSON` y `CASE_STUDIES_JSON`: textos
  secundarios y galerías; una galería `[]` queda oculta.

## Estructura

```text
app/                  UI, páginas y endpoints HTTP
components/           componentes compartidos
domain/               reglas de negocio puras
services/             casos de uso
repositories/         contratos y adaptadores de persistencia
integrations/         contratos de pagos, mensajes y secretos
lib/                  configuración, auth e infraestructura transversal
supabase/migrations/  esquema SQL y políticas RLS versionadas
supabase/seed.sql      datos ficticios
docs/                 decisiones y guías técnicas
```

Consulta [Arquitectura](docs/ARCHITECTURE.md), [flujo de Fase 1](docs/PHASE1_FLOW.md), [seguridad](docs/SECURITY.md), [pricing](docs/PRICING_ENGINE.md) y [despliegue](docs/DEPLOYMENT.md).
Para preparar una edición aislada para otra empresa, sigue [Producto replicable](docs/PRODUCTIZATION.md).
Para crear, activar, respaldar o recuperar manifiestos, sigue [Operación de ediciones](docs/EDITION_OPERATIONS.md).
Para crear Vercel, Supabase, variables, dominio y validaciones por cliente, sigue [Aprovisionamiento](docs/PROVISIONING.md).
Para cambiar una edición existente desde Vercel a su dominio definitivo, sigue [Activación del dominio oficial](docs/DOMAIN_GO_LIVE.md).
