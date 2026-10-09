# Flujo operativo de Fase 1

## Recorrido implementado en modo demo

1. Un visitante envía `/diagnostico`; el servidor valida, puntúa y crea el lead.
2. Sales abre `/admin/crm/[id]` y convierte el lead una sola vez.
3. Se crean una cuenta prospecto, su contacto principal y un evento de auditoría.
4. El cotizador toma del servidor las soluciones activas, recalcula precio y guarda un snapshot.
5. Al aprobar se crean solución, suscripción, items, período y seis recordatorios.
6. Una segunda solución actualiza el período pendiente sin duplicarlo ni duplicar recordatorios.
7. Finanzas genera un link mediante `MockPaymentProvider`.
8. El simulador emite un evento determinista; el servicio valida el monto persistido, marca el período pagado y cancela avisos futuros.
9. Repetir el mismo evento no produce efectos adicionales.

## Persistencia Supabase

Con `APP_MODE=supabase`, las lecturas usan los read models de Supabase y las mutaciones sensibles se ejecutan con la sesión autenticada. La conversión de lead y la aprobación de cotización llaman funciones PostgreSQL transaccionales; la cotización se persiste con RLS y su snapshot de precio. La función de eventos de pago queda reservada para un webhook confiable con clave secreta de servidor.

Las soluciones del portal se leen mediante `list_portal_solutions()`, que devuelve únicamente campos operativos. Los roles técnicos y de consulta no reciben columnas financieras aunque intenten acceder directamente a la API de datos.

## Límites conscientes

Las migraciones aún deben ejecutarse y validarse contra un proyecto PostgreSQL/Supabase real. El entorno local actual no dispone de Docker, por lo que las garantías transaccionales y la matriz RLS cuentan con pruebas estáticas, pero todavía requieren una prueba de integración por rol.

La ruta `/api/dev/payments/[id]/approve` responde únicamente en modo demo. En producción, el estado `approved` sólo podrá originarse en un webhook verificado.
