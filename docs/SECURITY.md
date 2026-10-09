# Seguridad

## Autorización

La UI usa guardas de rol, pero la autoridad definitiva es PostgreSQL RLS. Las políticas separan roles internos y clientes; toda lectura externa se limita mediante `current_account_id()`.

Roles internos: `owner_admin`, `sales`, `technical`, `finance`, `support`. Roles cliente: `client_admin`, `client_billing`, `client_technical`, `client_viewer`.

## Secretos

- Nunca se almacenan en tablas de negocio, navegador, logs o auditoría.
- `credential_metadata` sólo guarda referencias y metadata.
- `InMemorySecretStore` es exclusivamente de desarrollo y no persiste.
- Producción requiere un adaptador de vault/KMS y una `SUPABASE_SECRET_KEY` sólo en servidor; la service-role legacy queda como alternativa de compatibilidad.
- Los roles técnicos/consulta reciben soluciones desde una función con columnas permitidas, no desde la tabla que contiene snapshots financieros.
- RLS niega la escritura directa de cotizaciones. La ruta interna autoriza al actor, recalcula el precio en servidor y usa un cliente secreto aislado; un trigger SQL registra la creación.

## Pendientes antes de producción

- Activar login real Supabase y provisión administrada de usuarios.
- Obligar MFA para owner, technical y finance.
- Añadir rate limiting/CAPTCHA al diagnóstico público.
- Probar RLS contra Supabase local con usuarios por rol.
- Definir retención, backups, cifrado y respuesta a incidentes.
- Revisar CSP al definir dominios de analítica y proveedores.
