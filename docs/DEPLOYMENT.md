# Despliegue

Para pasar una edición ya desplegada desde la URL temporal de Vercel a un dominio
propio, sigue [DOMAIN_GO_LIVE.md](DOMAIN_GO_LIVE.md). El corte conserva los IDs de
Vercel y Supabase y actualiza URL pública, Auth, callbacks y metadatos desde una
sola fuente.

Para una nueva empresa usa el flujo aislado y reanudable de
[Aprovisionamiento de una edición](PROVISIONING.md). No vuelvas a enlazar este
directorio directamente, porque `.vercel` corresponde al proyecto de Impulsia.

## Vercel + Supabase

1. Crear el proyecto Supabase y revisar región/plan.
2. Ejecutar `supabase db push --dry-run` y revisar el SQL antes del push real.
3. Configurar variables del entorno Preview y Production en Vercel.
4. Usar `APP_MODE=supabase`; nunca desplegar producción en modo demo.
5. Ejecutar `npm run check` y desplegar.
6. Crear usuarios internos de forma administrada y asignar perfiles/roles.
7. Ejecutar pruebas RLS y smoke tests post-despliegue.

## Variables mínimas

`APP_MODE`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY` sólo será necesaria para jobs y webhooks confiables, nunca para el frontend. `SUPABASE_SERVICE_ROLE_KEY` se mantiene únicamente como alternativa legacy.

## Rollback

Las migraciones deben ser aditivas. Antes de cambios destructivos se crea una migración separada, backup verificado y plan de reversión. Los snapshots financieros no se reescriben.
