# Arquitectura

## Decisión base

Se usa un monolito modular con Next.js App Router. Mantiene una sola unidad desplegable para el MVP, pero separa el negocio de React y de Supabase. Es la opción más pequeña que permite vender rápido sin hipotecar tests ni proveedores futuros.

## Capas

```text
UI / HTTP (app, components)
        ↓
Casos de uso (services)
        ↓
Dominio puro (domain) ← contratos de repositorio/integración
        ↓
Adaptadores (repositories, integrations, lib/supabase)
        ↓
PostgreSQL/Supabase o memoria demo
```

- `domain`: pricing, suscripciones, pagos y recordatorios sin dependencias de framework.
- `services`: validación y orquestación de casos de uso.
- `repositories`: interfaz de persistencia; memoria demo y Supabase.
- `integrations`: interfaces que impiden acoplar casos de uso a pagos, email o vault concretos.
- `app`: Server Components por defecto y Client Components sólo para interacción.

## Modos

`APP_MODE=demo` permite ejecutar sin cuentas externas. `APP_MODE=supabase` activa persistencia y auth. El modo demo está rotulado en la UI y no es adecuado para producción.

## Decisiones relevantes

- El servidor recalcula precios; la UI nunca define el monto definitivo.
- Cada cotización guarda la regla completa y su versión.
- Los costos de terceros son items independientes y tienen una restricción SQL que prohíbe descuento.
- Los pagos no tienen políticas de escritura para usuarios: los webhooks futuros usarán un handler servidor validado.
- Conversión y aprobación se ejecutan como RPC PostgreSQL transaccionales; el conteo de soluciones se vuelve a comprobar al aprobar para exigir recotización ante carreras.
- El portal usa un read model operativo sin columnas financieras para `client_technical` y `client_viewer`; RLS sigue siendo la autoridad aunque la UI oculte secciones.
- Node 24 es el runtime local detectado. TypeScript se fijó en 6.0.2 porque TypeScript 7 aún no es compatible con la cadena `typescript-eslint` incluida por Next 16.3.5.
