# Aprovisionamiento de una edición

## Propósito

Crear una instalación aislada de la plataforma para una empresa compradora sin
reutilizar su base de datos, credenciales, proyecto Vercel ni enlaces locales en
otra edición.

El proceso usa tres artefactos:

```text
editions/<slug>/edition.json       marca, oferta y contenido público
editions/<slug>/deployment.json    destino público de Vercel y Supabase
.impulsia-secrets/<slug>.env       credenciales locales ignoradas por Git
```

Los manifiestos públicos son el respaldo vendible. El archivo de secretos nunca
se copia a otra edición ni se versiona.

Requisitos del operador:

- dependencias del proyecto instaladas, incluida Supabase CLI;
- Vercel CLI instalada fuera de las dependencias de la aplicación, o su ruta
  definida en `VERCEL_CLI_PATH`;
- acceso autorizado a las organizaciones de Vercel y Supabase correspondientes.

Vercel CLI se mantiene fuera de `package.json` para no incorporar su amplio árbol
de herramientas de despliegue —y sus alertas transitivas— al producto entregable.

## 1. Crear y personalizar la edición

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run edition:create -- `
  --slug empresa-demo `
  --name "Empresa Demo" `
  --legal-name "Empresa Demo SpA" `
  --email ventas@empresa.cl
```

Edita `editions/empresa-demo/edition.json`, agrega activos autorizados en
`/public` y valida el resultado:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run edition:validate -- `
  --file editions/empresa-demo/edition.json
```

## 2. Preparar el destino aislado

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:prepare -- `
  --slug empresa-demo `
  --app-url https://empresa-demo.vercel.app `
  --vercel-project empresa-demo `
  --vercel-scope equipo-vercel `
  --supabase-project empresa-demo `
  --supabase-org-id organizacion-supabase `
  --supabase-region sa-east-1
```

El comando no sobrescribe un plan existente salvo que se agregue `--force`.
También crea `.impulsia-secrets/empresa-demo.env`, ya excluido por `.gitignore`.

Completa allí las credenciales de operador:

- `VERCEL_TOKEN`, o una sesión local de Vercel CLI ya iniciada;
- `SUPABASE_ACCESS_TOKEN`, o una sesión local de Supabase ya iniciada;
- `SUPABASE_DB_PASSWORD` para crear/enlazar y migrar la base.

Los tokens de operador sirven para aprovisionar. El sistema los excluye de las
variables que se cargan a la aplicación.

## 3. Revisar antes de mutar servicios externos

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:validate -- `
  --slug empresa-demo --stage create

& 'C:\Program Files\nodejs\npm.cmd' run provision:plan -- --slug empresa-demo
```

`provision:plan` no cambia nada. La ejecución remota requiere repetir exactamente
el slug en `--confirm`, para evitar operar por accidente sobre otro cliente.

Antes de crear infraestructura se puede construir la edición con las mismas
variables que recibirá Vercel:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:rehearse -- --slug empresa-demo
```

Para ensayar directamente la plantilla vendible neutra:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:rehearse -- --template
```

El ensayo usa credenciales ficticias válidas sólo para compilar; no se conecta a
Supabase ni Vercel y no cambia la edición activa.

## 4. Ejecutar por fases

### Infraestructura

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug empresa-demo --phase infrastructure --confirm empresa-demo
```

Esta fase crea o enlaza Supabase y Vercel, obtiene sus identificadores públicos y
actualiza `deployment.json`. Los enlaces se guardan en un workspace aislado bajo
`.impulsia-secrets/work/empresa-demo`; no reemplazan `.vercel` ni el enlace
Supabase de Impulsia.

### Base de datos y Auth

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:validate -- `
  --slug empresa-demo --stage database

& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug empresa-demo --phase database --confirm empresa-demo
```

El kit crea un workspace Supabase aislado y ejecuta primero `db push --dry-run`
antes de aplicar sólo las migraciones versionadas —sin `seed.sql`. La fase
separada `auth` ejecuta `config diff` y luego configura `site_url`, redirects y
registro público para el dominio de la edición, sin exigir la contraseña de
Postgres.

### URLs y redirects de Auth

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:validate -- `
  --slug empresa-demo --stage auth

& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug empresa-demo --phase auth --confirm empresa-demo
```

El diff de configuración se imprime antes del cambio. La fase requiere una sesión
válida de Supabase CLI o `SUPABASE_ACCESS_TOKEN`, pero no la contraseña de la base.

### Variables de producción

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:validate -- `
  --slug empresa-demo --stage environment

& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug empresa-demo --phase environment --confirm empresa-demo
```

La marca, oferta, precios, catálogo y landing se derivan del manifiesto y se
cargan como configuración del proyecto. Así, un redeploy del código común no
puede convertir accidentalmente la edición de un cliente en la de otro. Los
tokens y claves privadas se marcan como sensibles; los tokens de operador no se
suben.

### Deploy, dominio y verificación

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug empresa-demo --phase deploy --confirm empresa-demo

& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug empresa-demo --phase domain --confirm empresa-demo

& 'C:\Program Files\nodejs\npm.cmd' run provision:verify -- --slug empresa-demo
```

La verificación exige HTTP 200 en landing, diagnóstico y login, y una redirección
al login al intentar abrir `/admin/dashboard` sin sesión.

También existe `--phase all`, pero debe usarse sólo después de revisar cada
destino, el dry-run de migraciones, la propiedad del dominio y las credenciales.

## Recuperación y auditoría

Cada fase completada se registra localmente en
`.impulsia-secrets/<slug>.provision-report.json`, sin valores secretos. Si una
fase falla, corrige el dato y repite únicamente esa fase.

Antes de entregar:

1. Ejecuta `npm run check`.
2. Ejecuta `npm run test:rls` y los smoke tests autenticados contra un entorno
   autorizado.
3. Revisa DNS/SSL y los redirects de Supabase Auth.
4. Crea el primer administrador mediante un proceso controlado.
5. Versiona `edition.json` y `deployment.json` cuando el usuario autorice el commit.
6. Conserva las credenciales en el gestor seguro del operador, nunca dentro del
   paquete vendible.
