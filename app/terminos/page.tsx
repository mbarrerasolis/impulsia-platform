import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBrandConfig } from "@/lib/brand";
import { socialMetadata } from "@/lib/seo";

const lastUpdated = "24 de septiembre de 2026";

export function generateMetadata(): Metadata {
  const brand = getBrandConfig();
  const description = `Condiciones de uso del sitio web y de contratación de los servicios de ${brand.name}.`;
  return {
    title: "Términos y condiciones",
    description,
    alternates: { canonical: "/terminos" },
    ...socialMetadata({ title: `Términos y condiciones | ${brand.name}`, description, path: "/terminos" }),
  };
}

export default function TermsPage() {
  const brand = getBrandConfig();
  const email = <a href={brand.contactHref}>{brand.contactEmail}</a>;
  const provider = `${brand.legalName}${brand.taxId ? `, RUT ${brand.taxId}` : ""}`;
  return <div className="page-shell"><SiteHeader/><main>
    <section className="simple-hero"><div className="container">
      <span className="eyebrow"><span className="dot"/> Última actualización: {lastUpdated}</span>
      <h1>Términos y condiciones</h1>
      <p className="hero-copy">Reglas para usar este sitio y para cotizar y contratar nuestros servicios de automatización, integración e inteligencia artificial.</p>
    </div></section>

    <section className="container legal-page">
      <h2>1. Quiénes somos</h2>
      <p>Este sitio y los servicios que se ofrecen en él pertenecen a {provider} (en adelante, «{brand.name}»). Puedes contactarnos en {email}.</p>

      <h2>2. Uso del sitio</h2>
      <p>Puedes usar este sitio para conocer nuestros servicios, solicitar un diagnóstico y contactarnos. Te comprometes a entregar información veraz y a no usar el sitio, sus formularios ni nuestros canales para enviar contenido ilícito o spam, suplantar a terceros o intentar vulnerar su seguridad.</p>

      <h2>3. Diagnósticos, rangos de precio y cotizaciones</h2>
      <ul>
        <li>El diagnóstico inicial y los rangos de precio que entregan el sitio o nuestro asistente de WhatsApp son <strong>referenciales</strong> y no constituyen una oferta ni nos obligan a prestar un servicio.</li>
        <li>El precio y el alcance definitivos constan en una <strong>cotización formal</strong> que indica las funcionalidades incluidas, los plazos estimados, el valor de la implementación, el valor de la mantención mensual y su vigencia.</li>
        <li>El servicio se entiende contratado cuando aceptas la cotización por escrito (por ejemplo, por correo electrónico o firma) o pagas el anticipo que ella indique.</li>
      </ul>

      <h2>4. Precios, facturación y pagos</h2>
      <ul>
        <li>Salvo que la cotización diga otra cosa, los precios se expresan en pesos chilenos y <strong>no incluyen IVA</strong>, que se agrega en la factura.</li>
        <li>Los costos de servicios externos necesarios para operar la solución (por ejemplo, servidores, mensajería de WhatsApp, SMS, modelos de inteligencia artificial, almacenamiento, licencias o APIs pagadas) no están incluidos, salvo que la cotización los incluya expresamente.</li>
        <li>La implementación se paga en la forma indicada en la cotización. La mantención se factura mensualmente por adelantado.</li>
        <li>Si un pago se atrasa, podemos suspender la mantención y el soporte de la solución afectada hasta que se regularice, previo aviso por correo.</li>
      </ul>

      <h2>5. Implementación</h2>
      <p>Los plazos de la cotización son estimados y dependen de que el cliente entregue a tiempo los accesos, la información y las validaciones que se le soliciten. Los cambios de alcance posteriores a la aceptación se cotizan por separado.</p>

      <h2>6. Mantención mensual</h2>
      <ul>
        <li>La mantención incluye el monitoreo, la corrección de fallas y el soporte de la solución implementada, según lo indicado en la cotización. Las nuevas funcionalidades se cotizan aparte.</li>
        <li>La mantención se renueva mes a mes. Puedes ponerle término avisando por escrito con al menos 30 días de anticipación, sin multas; se paga el período en curso.</li>
      </ul>

      <h2>7. Propiedad intelectual</h2>
      <p>Una vez pagada la implementación, el cliente puede usar la solución desarrollada para su negocio sin límite de tiempo. {brand.name} conserva la propiedad de sus herramientas, componentes y conocimientos previos o genéricos, que puede reutilizar en otros proyectos sin incluir información del cliente. Los datos y contenidos del cliente siempre le pertenecen.</p>

      <h2>8. Confidencialidad y datos personales</h2>
      <p>Tratamos como confidencial la información de tu negocio a la que accedamos para prestar el servicio. El tratamiento de datos personales se rige por nuestra <Link href="/privacidad">Política de privacidad</Link>.</p>

      <h2>9. Responsabilidad</h2>
      <ul>
        <li>Prestamos los servicios con diligencia profesional, pero no garantizamos resultados económicos específicos ni el funcionamiento ininterrumpido de servicios de terceros (como plataformas de mensajería, ERP, bancos o proveedores de nube) de los que dependa la solución.</li>
        <li>Las respuestas generadas con inteligencia artificial pueden contener errores; las decisiones relevantes deben ser revisadas por una persona.</li>
        <li>Salvo dolo o culpa grave, nuestra responsabilidad total por un servicio se limita al monto pagado por ese servicio durante los 12 meses anteriores al hecho que la origina.</li>
      </ul>

      <h2>10. Derechos del consumidor</h2>
      <p>Nuestros servicios están dirigidos a empresas. Si contratas como consumidor, estos términos se aplican sin perjuicio de los derechos que te otorga la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores.</p>

      <h2>11. Cambios, ley aplicable y contacto</h2>
      <p>Podemos actualizar estos términos; la versión vigente se publica en esta página con su fecha. Los servicios ya contratados se rigen por la cotización aceptada y por los términos vigentes a la fecha de su aceptación. Estos términos se rigen por las leyes de la República de Chile. Para consultas o reclamos escríbenos a {email}.</p>

      <p className="muted"><Link href="/">Volver al inicio</Link></p>
    </section>
  </main><SiteFooter/></div>;
}
