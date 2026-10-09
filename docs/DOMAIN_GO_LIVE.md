# Activación del dominio oficial

La aplicación puede seguir operando en la URL temporal de Vercel hasta que el
dominio esté adquirido. Mientras `NEXT_PUBLIC_APP_URL` sea `localhost` o termine
en `.vercel.app`, `robots.txt` bloquea la indexación. Al usar el dominio oficial,
el sitio publica su sitemap y permite indexar sólo la landing y el diagnóstico.

## Antes del corte

- Comprar el dominio y mantener acceso a su panel DNS.
- Confirmar que el despliegue temporal responde correctamente.
- No activar todavía Flow ni WhatsApp si sus credenciales productivas no existen.
- Conservar la URL temporal hasta terminar la propagación DNS.

## 1. Preparar el manifiesto local

Este comando sólo modifica `editions/impulsia/deployment.json`; no toca servicios
externos y conserva los IDs de Vercel y Supabase existentes.

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:domain -- `
  --slug impulsia --domain impulsialabs.cl
```

Revisar el cambio y el plan:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:validate -- --slug impulsia
& 'C:\Program Files\nodejs\npm.cmd' run provision:plan -- --slug impulsia
```

## 2. Asociar el dominio en Vercel

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug impulsia --phase domain --confirm impulsia
```

La inspección de Vercel entrega los registros DNS requeridos. Copiarlos exactamente
en el proveedor del dominio; no asumir valores fijos. Esperar hasta que Vercel
muestre el dominio como válido y el certificado HTTPS esté emitido.

## 3. Propagar la URL oficial

Actualizar primero Supabase Auth y las variables de Vercel, luego desplegar. La
fase `auth` muestra el diff remoto antes de aplicarlo y no necesita la contraseña
de Postgres:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug impulsia --phase auth --confirm impulsia
& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug impulsia --phase environment --confirm impulsia
& 'C:\Program Files\nodejs\npm.cmd' run provision:apply -- `
  --slug impulsia --phase deploy --confirm impulsia
```

La fase `auth` actualiza `site_url`/redirects de Supabase. La fase `environment`
cambia `NEXT_PUBLIC_APP_URL`, por lo que Flow, metadatos, canonical, sitemap y
callbacks usan el dominio oficial en el despliegue siguiente.

## 4. Verificar y cerrar

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run provision:verify -- --slug impulsia
```

Además comprobar manualmente:

- `https://impulsialabs.cl/robots.txt` permite las rutas públicas y bloquea privadas.
- `https://impulsialabs.cl/sitemap.xml` contiene sólo `/` y `/diagnostico`.
- login, recuperación de contraseña y cierre de sesión funcionan con cookies nuevas.
- `/admin/dashboard` sin sesión redirige a `/login`.
- los enlaces compartidos muestran título, descripción e imagen de ImpulsIA.

Después del corte se pueden registrar, usando la URL oficial:

- Flow: `https://impulsialabs.cl/api/webhooks/flow`.
- WhatsApp: `https://impulsialabs.cl/api/webhooks/whatsapp`.

La activación de cada proveedor conserva su checklist propio en
[PAYMENTS_GO_LIVE.md](PAYMENTS_GO_LIVE.md) y
[WHATSAPP_GO_LIVE.md](WHATSAPP_GO_LIVE.md).

## Reversión

Si el DNS o HTTPS no quedan listos, no borrar el proyecto ni cambiar credenciales.
Restaurar temporalmente `appUrl` a la URL de Vercel, dejar `customDomain` vacío,
repetir las fases `auth`, `environment` y `deploy`, y resolver DNS antes de un
nuevo intento.
