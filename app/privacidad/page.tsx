import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBrandConfig } from "@/lib/brand";
import { socialMetadata } from "@/lib/seo";

const lastUpdated = "25 de septiembre de 2026";

export function generateMetadata(): Metadata {
  const brand = getBrandConfig();
  const description = `Cómo ${brand.name} trata los datos personales de su sitio web, formularios y WhatsApp.`;
  return {
    title: "Política de privacidad",
    description,
    alternates: { canonical: "/privacidad" },
    ...socialMetadata({ title: `Política de privacidad | ${brand.name}`, description, path: "/privacidad" }),
  };
}

export default function PrivacyPage() {
  const brand = getBrandConfig();
  const email = <a href={brand.contactHref}>{brand.contactEmail}</a>;
  const metaPixel = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
  return <div className="page-shell"><SiteHeader/><main>
    <section className="simple-hero"><div className="container">
      <span className="eyebrow"><span className="dot"/> Última actualización: {lastUpdated}</span>
      <h1>Política de privacidad</h1>
      <p className="hero-copy">Explicamos qué datos personales tratamos, para qué, con quién los compartimos y cómo puedes ejercer tus derechos.</p>
    </div></section>

    <section className="container legal-page">
      <h2>1. Responsable</h2>
      <p>El responsable del tratamiento es {brand.legalName}{brand.taxId ? `, RUT ${brand.taxId}` : ""}. Para cualquier consulta sobre privacidad escríbenos a {email}.</p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li><strong>Formulario de diagnóstico:</strong> nombre, empresa, email, teléfono (opcional) y la información que nos entregues sobre tus procesos, sistemas, volúmenes y objetivos.</li>
        <li><strong>WhatsApp:</strong> tu número, el nombre de tu perfil y el contenido de los mensajes que intercambies con nosotros, junto con su estado de entrega. Si durante la conversación lo autorizas, también el nombre, empresa, email y necesidad que nos indiques.</li>
        <li><strong>Correo electrónico:</strong> los mensajes que nos envíes y tus datos de contacto.</li>
        <li><strong>Origen de tu visita:</strong> si llegas desde una publicación, un anuncio o un enlace con parámetros de campaña (por ejemplo, desde nuestro Instagram), guardamos en tu navegador de dónde vienes y lo asociamos a tu diagnóstico si lo envías, para saber qué canales nos traen consultas.</li>
        <li><strong>Clientes con acceso al portal:</strong> los datos de la cuenta necesarios para iniciar sesión y prestar el servicio contratado.</li>
      </ul>
      <p>No te pedimos datos sensibles, contraseñas ni datos bancarios o de tarjetas por WhatsApp ni por el formulario.</p>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Responder tus consultas y la solicitud de diagnóstico que nos hiciste.</li>
        <li>Contactarte sobre esa solicitud, sólo si lo autorizaste expresamente.</li>
        <li>Preparar propuestas y cotizaciones, y prestar los servicios contratados.</li>
        <li>Mantener la seguridad del sitio y cumplir obligaciones legales.</li>
      </ul>
      <p>No usamos tus datos para envíos publicitarios ajenos a tu solicitud ni los vendemos a terceros.</p>

      <h2>4. Asistente automático en WhatsApp</h2>
      <p>Nuestro canal de WhatsApp puede ser atendido inicialmente por un asistente automático basado en inteligencia artificial, que responde consultas, entrega rangos de precio referenciales registra tu solicitud cuando lo autorizas y puede agendar una videollamada con nuestro equipo si se lo pides. Los rangos de precio son orientativos y no constituyen una oferta. En cualquier momento puedes pedir hablar con una persona y el asistente derivará la conversación a nuestro equipo.</p>

      <h2>5. Con quién los compartimos</h2>
      <p>Usamos proveedores que tratan datos por cuenta nuestra, sólo para prestar el servicio:</p>
      <ul>
        <li><strong>Meta Platforms</strong> (WhatsApp Business), para enviar y recibir mensajes de WhatsApp{metaPixel && <> y, sólo si aceptas las cookies de publicidad, para medir nuestros anuncios (ver Cookies)</>}.</li>
        <li><strong>Anthropic</strong>, proveedor del modelo de inteligencia artificial que genera las respuestas del asistente.</li>
        <li><strong>Supabase</strong>, para el almacenamiento de la base de datos.</li>
        <li><strong>Vercel</strong>, para el alojamiento del sitio web.</li>
        <li><strong>Resend</strong> y <strong>Google Workspace</strong>, para el envío y la recepción de correos y, cuando agendas una reunión, para crear la invitación en nuestro calendario con enlace de Google Meet.</li>
        <li><strong>Cloudflare</strong>, para la resolución del dominio y, cuando está activa, la verificación antispam del formulario (Turnstile).</li>
      </ul>
      <p>Algunos de estos proveedores pueden almacenar o procesar datos fuera de Chile. También podremos entregar datos cuando una autoridad competente lo exija conforme a la ley.</p>

      <h2>6. Cuánto tiempo los conservamos</h2>
      <p>Conservamos los datos mientras sean necesarios para atender tu solicitud o la relación comercial y, después, durante los plazos que exija la ley. Los datos de prospectos que no avancen pueden eliminarse antes si lo solicitas.</p>

      <h2>7. Tus derechos y eliminación de datos</h2>
      <p>Puedes solicitar acceso, rectificación, eliminación u oposición al tratamiento de tus datos, y retirar tu autorización de contacto, conforme a la normativa chilena de protección de datos personales.</p>
      <p>Para eliminar tus datos, incluidos los de tus conversaciones de WhatsApp, escribe a {email} con el asunto «Eliminación de datos», indicando el email o número de WhatsApp con que nos contactaste. Confirmaremos la eliminación en un plazo razonable, salvo los datos que debamos conservar por obligación legal. También puedes pedirlo escribiendo «eliminar mis datos» en nuestro WhatsApp.</p>

      <h2>8. Seguridad</h2>
      <p>Aplicamos medidas técnicas y organizativas razonables: conexiones cifradas, control de acceso por roles y verificación de la autenticidad de los mensajes recibidos desde WhatsApp.</p>

      <h2 id="cookies">9. Cookies</h2>
      <p>Este sitio usa las siguientes cookies y tecnologías similares <strong>estrictamente necesarias</strong> para funcionar:</p>
      <ul>
        <li><strong>Sesión de usuario</strong> (<code>sb-…-auth-token</code>): mantiene iniciada la sesión de clientes y equipo en el portal y el panel. Sólo se crea si inicias sesión y se elimina al cerrarla o cuando expira.</li>
        <li><strong>Protección antispam</strong> (Cloudflare Turnstile): cuando está activa, verifica en el formulario de diagnóstico que quien lo envía es una persona. Cloudflare puede usar cookies o señales técnicas del navegador sólo para ese fin.</li>
      </ul>
      <p>Además guardamos en el almacenamiento local de tu navegador (no es una cookie ni se comparte con terceros) el <strong>origen de tu visita</strong> descrito en la sección 2. Se reemplaza en tu siguiente visita desde otro canal y deja de usarse a los 90 días.</p>
      <p>También <strong>contamos las visitas de forma anónima</strong>: por cada sesión de navegación guardamos sólo un identificador aleatorio que vive en esa pestaña, la página por la que entraste y ese mismo origen (red, campaña o sitio de referencia). No guardamos tu IP, tu navegador ni cookies, y no podemos asociarlo a tu identidad; sirve para saber qué canales traen visitas que terminan en consultas.</p>
      {metaPixel
        ? <p><strong>Cookies de publicidad (opcionales):</strong> sólo si las aceptas en el aviso de cookies, activamos el píxel de Meta (<code>_fbp</code>, <code>_fbc</code>), que informa a Meta tus visitas y si enviaste un diagnóstico o abriste WhatsApp, para medir qué publicaciones y anuncios de Facebook e Instagram funcionan. En ese caso también enviamos a Meta, directamente desde nuestro servidor, el aviso de que enviaste un diagnóstico con tu email y teléfono cifrados de forma irreversible (hash), para que Meta pueda asociarlo sin recibirlos en claro. Si las rechazas, no se carga nada de Meta. Puedes cambiar tu decisión cuando quieras en «Cookies», al pie de cada página. No usamos cookies de analítica de terceros.</p>
        : <p>No usamos cookies de publicidad ni de analítica de terceros. Si en el futuro las incorporamos, lo informaremos en esta sección y te pediremos tu consentimiento antes de activarlas.</p>}
      <p>Puedes borrar o bloquear las cookies desde la configuración de tu navegador; si bloqueas las de sesión, no podrás ingresar al portal.</p>

      <h2>10. Cambios</h2>
      <p>Podemos actualizar esta política. Publicaremos la versión vigente en esta página indicando la fecha de actualización.</p>

      <p className="muted">Consulta también nuestros <Link href="/terminos">Términos y condiciones</Link>. <Link href="/">Volver al inicio</Link></p>
    </section>
  </main><SiteFooter/></div>;
}
