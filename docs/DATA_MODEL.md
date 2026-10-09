# Modelo de datos

Las migraciones canónicas viven en `supabase/migrations`.

## Áreas

- Identidad: `profiles` vincula `auth.users` con un rol y, para clientes, un `account_id` obligatorio.
- Clientes: `accounts`, `contacts`, `contact_roles`.
- CRM: `leads`, `opportunities`, `activities`.
- Cotización y entrega: `quotes`, `solution_catalog`, `client_solutions`, `implementation_tasks`, `third_party_cost_items`.
- Recurrencia: `subscriptions`, `subscription_items`.
- Cobranza: `billing_periods`, `invoices`, `payments`, `payment_events`, `payment_reminders`.
- Omnicanal: `channels`, `conversations`, `messages`.
- Seguridad: `integrations`, `credential_metadata`, `audit_log`.
- Analítica: `marketing_spend`; el resto de indicadores se deriva de transacciones.

## Invariantes

- No existe columna para contraseñas o secretos reales.
- Un perfil cliente siempre pertenece a una cuenta.
- Un costo externo no puede tener descuento (`third_party_has_no_expansion_discount`).
- Los eventos y pagos externos tienen claves únicas para idempotencia.
- MRR se calcula desde items activos, nunca desde un único total mutable.
- Los datos de seed usan dominios `example.com` y personas ficticias.
