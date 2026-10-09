# ImpulsIA como plataforma de ventas configurable (plan)

Decisión del 1 de octubre de 2026: ImpulsIA es **el producto**: portal de ventas + CRM + Claudia,
configurable por cliente para vender **B2B o B2C**, **servicios o productos**, e **integrable con un
ERP** (el primero, FrutoFlow). Cada cliente sigue siendo una edición aislada (Vercel + Supabase +
dominio propios, ver `PRODUCTIZATION.md`).

## Arquitectura resultante (dos aplicaciones)

```text
Clientes finales ─► IMPULSIA (por cliente)                    ◄─ API firmada ─►  ERP (FrutoFlow u otro)
                    · sitio / portal de ventas (catálogo,                          fuente de verdad de
                      cotizador o tienda según el negocio)                         precios, stock, pedidos,
                    · CRM, procedencia, campañas y gastos                          caja, SII y finanzas
                    · WhatsApp + Claudia
```

El portal de ventas de `Escritorio\FrutoFlow_Especificaciones` deja de ser una tercera app: **es la
parte pública de ImpulsIA**. El ERP sigue separado (privado, con sus propios datos y accesos).

## Qué está hoy amarrado a "servicios B2B" y qué cambia

| Pieza | Hoy | Configurable |
|---|---|---|
| Perfil de negocio | implícito (servicios B2B) | `business.model` (`b2b`/`b2c`/`mixed`) y `business.offering` (`services`/`products`/`mixed`) en la edición |
| Módulos | todos visibles | `modules`: cotizador por jornadas, catálogo/tienda, suscripciones y cobranza, agenda de reuniones, ERP; menú y rutas se activan según la edición |
| Captura de leads | formulario de diagnóstico (empresa, sistemas, horas) | formulario por edición: B2B (empresa, necesidad) o B2C (nombre, teléfono, producto de interés) |
| Catálogo | plantillas de servicios con jornadas | servicios (cotizador actual) o productos (desde el ERP o un catálogo local si el cliente no tiene ERP) |
| Claudia | conocimiento fijo de ImpulsIA (`config/sales-knowledge.json`) | conocimiento por edición (`editions/<slug>/sales-knowledge.json`) y herramientas según el negocio: servicios → cotizar/agendar; productos → ver catálogo, stock, despacho, crear pedido con link de pago |
| Ingresos | suscripciones de servicios | además, ventas del ERP (`order.paid`) para ROAS y CAC con ingresos reales en Campañas y gastos |
| ERP | no existe | interfaz `ErpProvider` (`integrations/erp`) con adaptadores `none` y `frutoflow` (contrato `api/portal-erp.openapi.yaml`) + receptor de webhooks `/api/webhooks/erp` |

Ya son genéricos y no cambian: CRM y procedencia, bandeja de WhatsApp, Campañas y gastos, marca y
ediciones, correo, píxel/CAPI, pagos Flow.

## Fases propuestas

1. **Perfil de negocio y módulos** en el manifiesto de edición; menú, rutas y sitemap según módulos;
   validación en `edition:validate`. La edición `impulsia` queda como `b2b` + `services` (sin cambios
   visibles).
   **Hecho (1-oct-2026, commit 7b7528d):** `domain/config/business.ts`, `lib/business.ts`, layouts de
   módulo, APIs con 404, menú, landing, dashboard y Ajustes. `store` y `erp` existen como flags, sin
   pantallas aún (fases 4–5).
2. **Claudia por edición**: conocimiento y prompt según el perfil; test que impide filtrar el
   conocimiento de una edición en otra.
3. **Captura de leads configurable** (formulario B2B/B2C) manteniendo antispam, consentimiento y
   atribución.
4. **Conector ERP** (`ErpProvider` + FrutoFlow + webhooks firmados), con un ERP simulado para
   probar sin FrutoFlow.
5. **Tienda de productos** en el portal (catálogo con caché, carrito, checkout con pago en el ERP,
   seguimiento) y herramientas de Claudia sobre el ERP.
6. **Ingresos y ROAS** en Campañas y gastos con las ventas del ERP.
7. **Carpeta de cliente** (`clientes/<slug>/`: mapa de sistemas, accesos referenciados al gestor de
   secretos, marca, customizaciones) como plantilla para cada nueva implementación.

Para el cliente de frutos secos (B2C, productos, FrutoFlow): fases 1 → 2 → 3 → 4 → 5.
