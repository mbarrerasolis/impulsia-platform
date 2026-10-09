# Operación y respaldo de ediciones

## Objetivo

Mantener dos cosas separadas y recuperables:

1. el producto base vendible, sin credenciales ni datos de clientes;
2. la edición activa que se publica para una empresa concreta.

La aplicación carga `config/edition.json`. Las variables de entorno pueden
sobrescribir valores puntuales, pero el manifiesto es la fuente versionable de
marca, oferta, pricing, catálogo, textos y galerías.

## Estructura

```text
config/edition.json              edición activa
editions/_template/edition.json plantilla B2B neutra
editions/<slug>/edition.json    respaldo aprobado por cliente
editions/_history/*.json        copias automáticas antes de activar otra edición
public/                          activos referenciados por los manifiestos
```

Los manifiestos son configuración pública. Nunca deben contener tokens, claves,
contraseñas, datos de prospectos ni información privada del comprador.

## Comandos

Validar la edición activa y comprobar que existen sus imágenes:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run edition:validate
```

Crear una edición desde la plantilla neutra:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run edition:create -- `
  --slug empresa-demo `
  --name "Empresa Demo" `
  --legal-name "Empresa Demo SpA" `
  --email ventas@empresa.cl `
  --currency CLP `
  --locale es-CL
```

El comando no sobrescribe una edición existente. Después se personaliza
`editions/empresa-demo/edition.json` y se agregan sus imágenes a `/public`.

Respaldar la edición activa:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run edition:snapshot -- --slug impulsia
```

Para reemplazar deliberadamente un respaldo existente se requiere `--force`.

Activar una edición aprobada:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run edition:activate -- --slug empresa-demo
```

Antes de reemplazar `config/edition.json`, el comando guarda automáticamente la
edición activa en `editions/_history` con fecha y hora.

## Checklist antes de publicar

1. Validar el manifiesto y sus activos con `edition:validate`.
2. Revisar nombre, email, dominio, moneda, precios, textos, consentimientos y
   capturas.
3. Confirmar que no hay datos ni credenciales del cliente en Git.
4. Ejecutar `npm run check`.
5. Aplicar migraciones en el Supabase correcto y ejecutar pruebas RLS/smoke.
6. Respaldar la edición activa antes de cambiarla.
7. Commit y tag de la versión entregable cuando el usuario lo autorice.
8. Desplegar y verificar landing, formulario, login, cotizador, pagos y portal.
9. Mantener secretos en Vercel/Supabase; respaldarlos mediante el procedimiento
   seguro del operador, nunca dentro del paquete vendible.

La creación de proyectos, variables, migraciones, dominio y smoke tests se
ejecuta con [Aprovisionamiento de una edición](PROVISIONING.md).

## Recuperación

Para recuperar una edición anterior, copia el manifiesto aprobado desde
`editions/<slug>/edition.json` o desde `editions/_history` a
`config/edition.json`, ejecuta `npm run check` y vuelve a desplegar. La base de
datos se recupera por separado usando backups de Supabase; los manifiestos no
contienen datos transaccionales.

## Perfil de negocio y módulos

Cada manifiesto declara a quién vende y qué vende, y qué módulos usa:

```json
"business": { "model": "b2c", "offering": "products" },
"modules": { "quotes": false, "subscriptions": false, "clientPortal": false, "whatsapp": true,
             "meetings": false, "store": true, "erp": true, "sectorLandings": [] }
```

- `model`: `b2b`, `b2c` o `mixed` (cambia textos como "Cuentas" → "Clientes").
- `offering`: `services`, `products` o `mixed`. Sin `modules`, los módulos salen de este valor.
- Un módulo apagado desaparece del menú y sus páginas y APIs responden 404.
- Reglas: el cotizador exige vender servicios; soluciones y cobranza exigen el cotizador; el portal de
  clientes exige soluciones; la tienda exige vender productos; la agenda exige WhatsApp.
  `edition:validate` y la app rechazan combinaciones incoherentes.
- `sectorLandings` publica páginas sectoriales propias de la edición (hoy: `salud`).
- Crear una edición con perfil: `edition:create -- --slug x --name "X" --email ventas@x.cl --model b2c --offering products`.
- Ajustes (`/admin/settings`) muestra el perfil y los módulos activos.
