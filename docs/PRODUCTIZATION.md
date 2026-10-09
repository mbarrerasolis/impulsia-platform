# Producto replicable y vendible

## Modelo de entrega actual

La primera versión comercial usa una **edición aislada por empresa**: el mismo
repositorio se despliega con configuración, dominio, Supabase y credenciales
propias para cada comprador.

Esta decisión permite vender e implementar ahora con una separación fuerte de
datos y secretos. No convierte todavía una única instalación en un SaaS de
múltiples operadores. El `account_id` existente separa a los clientes finales
dentro de una edición; no representa a la empresa que compra la plataforma.

Cada edición se conserva además como un manifiesto JSON versionable:

- `config/edition.json` es la edición activa del repositorio;
- `editions/_template/edition.json` es la base neutra y vendible;
- `editions/<slug>/edition.json` contiene respaldos recuperables por cliente.

Los secretos quedan fuera del manifiesto y se cargan sólo en el entorno de cada
despliegue. Consulta [Operación y respaldo de ediciones](EDITION_OPERATIONS.md)
para crear, validar, activar o recuperar una edición.

## Qué cambia sin tocar código

Las variables `NEXT_PUBLIC_BRAND_*` controlan:

- nombre comercial y razón social;
- texto de metadatos, descripción y propuesta principal del hero;
- email comercial y enlaces de contacto;
- colores principal, oscuro, acento y superficies privadas;
- nombre visible en navegación, portal, administración, WhatsApp, pagos Flow,
  favicon e imagen Open Graph.

Los valores se validan durante el build. Los colores deben usar formato
hexadecimal completo, por ejemplo `#123456`.

La configuración comercial usa `NEXT_PUBLIC_COMMERCE_*`, `PRICING_*` y
`SOLUTION_CATALOG_JSON` para controlar:

- locale y moneda ISO de tres letras;
- versión y vigencia de las reglas;
- valor jornada, mínimos y redondeo;
- factores de complejidad, tramos de mantención y descuentos de expansión;
- catálogo de plantillas que precarga nombre, jornadas y complejidad en el
  cotizador.

El navegador recibe las reglas para previsualizar, pero el servidor vuelve a
calcular la cotización con la misma configuración antes de guardarla. La regla
completa y su moneda permanecen en el snapshot histórico.

`LANDING_CONTENT_JSON` puede reemplazar bloques completos de venta incluidos en
el objeto; los demás conservan los valores del manifiesto activo. Esto incluye
CTA, señales de confianza, audiencias, beneficios, capacidades, panel de prueba,
proceso, argumentos de precio, cierre y presentación del formulario. El mensaje
inicial de WhatsApp también vive en el manifiesto y puede sobrescribirse con
`NEXT_PUBLIC_WHATSAPP_MESSAGE`.
`PRODUCT_SHOWCASE_JSON` y `CASE_STUDIES_JSON` reciben listas con esta
forma:

```json
[
  {
    "key": "dashboard",
    "imagePath": "/screenshots/dashboard.jpg",
    "pathLabel": "/admin/dashboard",
    "alt": "Dashboard ejecutivo",
    "width": 1517,
    "height": 703
  }
]
```

Las imágenes deben existir dentro de `/public`. Una lista `[]` oculta la sección
completa, evitando publicar capturas de otra marca mientras se preparan activos
propios.

## Crear una edición para una empresa

1. Crear proyectos separados en Vercel y Supabase.
2. Copiar las variables de `.env.example` al entorno del nuevo despliegue.
3. Completar `NEXT_PUBLIC_APP_URL` con el dominio definitivo.
4. Definir todas las variables `NEXT_PUBLIC_BRAND_*` con la identidad aprobada.
5. Definir `NEXT_PUBLIC_COMMERCE_*`, `PRICING_*`, catálogo, contenido y galerías.
6. Configurar Supabase, autenticación y redirects para el nuevo dominio.
7. Aplicar las migraciones y cargar sólo catálogo/precios aprobados; nunca el seed
   de demostración en producción.
8. Crear el primer `owner_admin` de la empresa compradora.
9. Conectar proveedores opcionales —Flow, email y WhatsApp— usando credenciales
   exclusivas de esa edición.
10. Ejecutar `npm run check`, `npm run test:rls` y los smoke tests aplicables.
11. Verificar landing, diagnóstico, login, cotizador, panel, portal, metadatos,
    favicon y
    Open Graph antes de entregar.

Los importes se representan hoy como unidades monetarias enteras. Flow continúa
limitado a CLP; una edición en otra moneda puede cotizar y operar con pago manual
o mock, pero necesita un proveedor de pago compatible antes de activar cobro real.

## Elementos que aún requieren preparación comercial

- Preparar términos, privacidad, soporte, SLA y proceso de alta/baja.
- Completar el proceso comercial y contractual de alta/baja. El aprovisionamiento
  técnico ya cuenta con preparación, validación, ejecución por fases y smoke HTTP;
  aún requiere las cuentas, credenciales y dominio autorizados para cada cliente.

## Siguiente evolución

Cuando exista demanda suficiente para operar varias empresas compradoras en una
sola instalación, se debe introducir una entidad `organizations` (o `tenants`) y
agregar `organization_id` a perfiles, clientes, catálogo, pricing, canales,
integraciones y auditoría. Esa migración requiere nuevas políticas RLS y no debe
confundirse con el `account_id` actual.
