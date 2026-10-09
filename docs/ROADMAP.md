# Roadmap

## Entregado

- Fase 0: scaffold, capas, configuración, Supabase, esquema, seed, RBAC/RLS, tests, CI y documentación.
- Corte vertical Fase 1: landing, diagnóstico/lead, CRM, cuentas/contactos, motor y pantalla de cotización, pricing y portal demo.
- Flujo comercial demo completo: conversión de lead, cotización persistida, aprobación, solución, suscripción, período, link/pago mock, cancelación de recordatorios, auditoría e idempotencia.
- Workflows Supabase para conversión, cotización y aprobación; RPC transaccional de pagos preparado para un webhook verificado.
- Read models Supabase para CRM, cuentas, cotizaciones, soluciones, cobranza y portal con separación financiera por rol.
- Fundación de producto replicable por despliegue: nombre, contacto, propuesta,
  tema visual, metadatos, portal, WhatsApp y pagos configurables sin cambiar código.
- Read models administrativos optimizados: paginación de 20 filas, agregados SQL
  para dashboard, consultas sin N+1 e índices para los órdenes operativos.
- Salida a dominio oficial preparada: canonical y metadatos sociales dinámicos,
  `robots.txt` que bloquea hosts temporales y rutas privadas, sitemap público y
  comando de corte que conserva los IDs existentes de Vercel/Supabase.

## Producto replicable

- Entregado: edición aislada por empresa mediante variables `NEXT_PUBLIC_BRAND_*`,
  con dominio, Supabase y credenciales propios.
- Entregado: catálogo, locale, moneda y reglas de precio configurables por
  edición; el cotizador utiliza plantillas y el servidor conserva snapshots.
- Entregado: textos secundarios y galerías configurables; las secciones de
  capturas pueden reemplazarse u ocultarse sin modificar componentes.
- Entregado: bloques centrales de conversión configurables —CTA, confianza,
  audiencias, beneficios, capacidades, prueba, proceso, pricing, cierre y entrada
  al formulario— para que la plantilla neutra no herede el discurso de Impulsia.
- Entregado: manifiesto activo versionable, plantilla comercial neutra, respaldo
  de Impulsia y comandos para crear, validar, respaldar y activar ediciones. Cada
  activación conserva automáticamente la edición anterior en el historial.
- Entregado: aprovisionamiento por fases para proyectos Vercel/Supabase,
  migraciones sin seed, configuración Auth, variables, despliegue, dominio y smoke
  HTTP; usa workspaces y secretos separados por cliente y exige confirmación.
- Siguiente bloque: ejecutar el kit con una edición de prueba autorizada, revisar
  el recorrido completo y preparar contrato, soporte, SLA y alta/baja comercial.
- Evolución posterior: evaluar un SaaS compartido con `organization_id` sólo
  cuando el volumen comercial justifique la complejidad adicional de RLS y
  operación multiempresa.

## Próximo bloque recomendado (completo)

1. ~~Instalar Docker Desktop o conectar un proyecto Supabase de desarrollo y ejecutar las migraciones.~~ Hecho.
2. ~~Generar tipos desde la base aplicada y reemplazar los casts temporales del adaptador Supabase.~~ Hecho.
3. ~~Añadir pruebas RLS ejecutables con usuarios por rol y E2E del recorrido Supabase completo.~~ Hecho (`test:rls`, `smoke:commercial`, `smoke:billing`).
4. ~~Conectar un proveedor de pago real y su webhook validado a `process_payment_event_transaction`.~~ Hecho en código (Flow); pendiente sólo lo no técnico — ver [PAYMENTS_GO_LIVE.md](PAYMENTS_GO_LIVE.md).
5. ~~Edición de contactos desde la UI (roles, contacto principal de facturación, activar/desactivar).~~ Hecho (`npm run smoke:contacts`).
   ~~Pago manual con evidencia.~~ Hecho (`npm run smoke:manual-payment`): botón "Pago manual" en Cobranza, registra el pago vía `process_payment_event_transaction` con una referencia de texto como evidencia (banco/N° de transferencia).
   ~~Tareas de implementación.~~ Hecho (`npm run smoke:tasks`): `/admin/solutions/[id]` (nueva página de detalle) con panel de tareas — crear, asignar a un perfil interno, marcar estado y horas reales.

## Después

- Fase 2: cobranza, email, expansión e historial MRR.
- Fase 3: omnicanal oficial. Base de WhatsApp Cloud API entregada (botón,
  webhook firmado, persistencia, calificación, derivación y operación humana con
  historial, asignación, respuesta y cierre); pendiente conectar el
  número/credenciales de Meta y ejecutar el piloto real.
- Fase 4: recomendaciones de IA con trazabilidad y aprobación humana.
