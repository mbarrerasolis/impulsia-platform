import { z } from "zod";
import { currentPricingRules } from "@/domain/pricing/rules";
import { pricingRulesSchema } from "@/domain/pricing/schemas";
import type { ComplexityKey, PricingRules } from "@/domain/pricing/types";

const catalogItemSchema = z.object({
  key: z.string().trim().min(2).max(80),
  name: z.string().trim().min(3).max(160),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(3).max(500),
  defaultDays: z.number().positive().max(365),
  defaultComplexity: z.enum(["standard", "medium", "high", "research", "advanced_research"]),
});

const showcaseItemSchema = z.object({
  key: z.string().trim().min(2).max(80),
  imagePath: z.string().trim().regex(/^\/[A-Za-z0-9/_-]+\.(png|jpe?g|webp)$/i, "La captura debe ser una imagen dentro de /public."),
  pathLabel: z.string().trim().min(2).max(160),
  alt: z.string().trim().min(5).max(240),
  width: z.number().int().positive().max(5000),
  height: z.number().int().positive().max(5000),
});

const copyCardSchema = z.object({
  title: z.string().trim().min(3).max(140),
  text: z.string().trim().min(10).max(360),
});

const capabilitySchema = copyCardSchema.extend({
  tag: z.string().trim().min(2).max(80),
});

const proofPanelSchema = z.object({
  enabled: z.boolean(),
  ariaLabel: z.string().trim().min(3).max(140),
  eyebrow: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3).max(140),
  metrics: z.array(z.object({
    label: z.string().trim().min(2).max(80),
    value: z.number().int().nonnegative().max(999999999),
    suffix: z.string().max(12).default(""),
    thousands: z.boolean().default(false),
    accent: z.enum(["lime", "azure", "violet", "orange"]),
  })).min(1).max(4),
  activities: z.array(z.object({
    name: z.string().trim().min(3).max(100),
    detail: z.string().trim().min(2).max(100),
    status: z.string().trim().min(2).max(40),
  })).min(1).max(4),
});

const floatingChatSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(3).max(80),
  incoming: z.string().trim().min(3).max(160),
  outgoing: z.string().trim().min(3).max(160),
  status: z.string().trim().min(3).max(80),
});

const salesCycleSchema = z.object({
  title: z.string().trim().min(5).max(120),
  caption: z.string().trim().min(10).max(360),
  /** Centro del diagrama, una frase corta por línea. */
  centerLines: z.array(z.string().trim().min(2).max(24)).min(1).max(3),
  steps: z.array(z.object({
    label: z.string().trim().min(2).max(22),
    detail: z.string().trim().min(2).max(28),
    text: z.string().trim().min(10).max(200),
    icon: z.enum(["ad", "chat", "crm", "calendar", "erp", "chart"]),
  })).length(6),
});

const assistantDemoSchema = z.object({
  eyebrow: z.string().trim().min(2).max(80),
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(10).max(400),
  exchanges: z.array(z.object({
    from: z.enum(["customer", "assistant"]),
    text: z.string().trim().min(3).max(240),
    action: z.string().trim().min(3).max(140),
    actionDetail: z.string().trim().min(3).max(200),
  })).min(2).max(6),
  canTitle: z.string().trim().min(3).max(80),
  can: z.array(z.string().trim().min(3).max(140)).min(1).max(6),
  cannotTitle: z.string().trim().min(3).max(80),
  cannot: z.array(z.string().trim().min(3).max(140)).min(1).max(6),
});

const beforeAfterSchema = z.object({
  eyebrow: z.string().trim().min(2).max(80),
  title: z.string().trim().min(5).max(140),
  beforeLabel: z.string().trim().min(2).max(40),
  afterLabel: z.string().trim().min(2).max(40),
  rows: z.array(z.object({
    before: z.string().trim().min(5).max(160),
    beforeNote: z.string().trim().min(3).max(140).optional(),
    after: z.string().trim().min(5).max(160),
  })).min(2).max(8),
});

const manifestoSchema = z.object({
  /** Primera frase, más chica. */
  lead: z.string().trim().min(3).max(80),
  /** Frase principal; `highlight` debe ser parte de ella y se marca en verde. */
  statement: z.string().trim().min(5).max(160),
  highlight: z.string().trim().min(2).max(80).optional(),
  text: z.string().trim().min(10).max(300).optional(),
});

const landingContentSchema = z.object({
  /** Bloques opcionales de la portada: si faltan, la sección no se muestra. */
  manifesto: manifestoSchema.optional(),
  salesCycle: salesCycleSchema.optional(),
  assistantDemo: assistantDemoSchema.optional(),
  beforeAfter: beforeAfterSchema.optional(),
  primaryCtaLabel: z.string().trim().min(3).max(80),
  secondaryCtaLabel: z.string().trim().min(3).max(80),
  secondaryCtaTarget: z.enum(["diagnostic", "contact"]),
  trustItems: z.array(z.string().trim().min(3).max(120)).min(1).max(5),
  audienceLabels: z.array(z.string().trim().min(2).max(80)).min(1).max(8),
  missionEyebrow: z.string().trim().min(2).max(80),
  missionTitle: z.string().trim().min(5).max(180),
  missionDescription: z.string().trim().min(10).max(400),
  benefits: z.array(copyCardSchema).min(1).max(6),
  solutionsEyebrow: z.string().trim().min(2).max(80),
  solutionsTitle: z.string().trim().min(5).max(180),
  solutionsDescription: z.string().trim().min(10).max(400),
  capabilities: z.array(capabilitySchema).min(1).max(9),
  proofPanel: proofPanelSchema,
  productEyebrow: z.string().trim().min(2).max(80),
  productTitle: z.string().trim().min(5).max(180),
  productDescription: z.string().trim().min(10).max(400),
  floatingChat: floatingChatSchema,
  caseStudyEyebrow: z.string().trim().min(2).max(80),
  caseStudyTitle: z.string().trim().min(5).max(180),
  caseStudyDescription: z.string().trim().min(10).max(400),
  processEyebrow: z.string().trim().min(2).max(80),
  processTitle: z.string().trim().min(5).max(180),
  processDescription: z.string().trim().min(10).max(400),
  processSteps: z.array(copyCardSchema).min(1).max(5),
  pricingEyebrow: z.string().trim().min(2).max(80),
  pricingTitle: z.string().trim().min(5).max(180),
  pricingBenefits: z.array(z.string().trim().min(3).max(180)).min(1).max(6),
  finalCtaTitle: z.string().trim().min(5).max(180),
  finalCtaDescription: z.string().trim().min(10).max(400),
  diagnosticEyebrow: z.string().trim().min(3).max(120),
  diagnosticTitle: z.string().trim().min(5).max(180),
  diagnosticDescription: z.string().trim().min(10).max(400),
  /** Título para buscadores de /diagnostico (sin la marca); si falta se usa `diagnosticTitle`. */
  diagnosticMetaTitle: z.string().trim().min(10).max(48).optional(),
  /** Descripción para buscadores de /diagnostico; si falta se usa `diagnosticDescription`. */
  diagnosticMetaDescription: z.string().trim().min(50).max(160).optional(),
});

export type SolutionCatalogItem = z.infer<typeof catalogItemSchema>;
export type ShowcaseItem = z.infer<typeof showcaseItemSchema>;
export type LandingContent = z.infer<typeof landingContentSchema>;

export interface EditionConfig {
  locale: string;
  pricing: PricingRules;
  catalog: SolutionCatalogItem[];
  landing: LandingContent;
  productShowcase: ShowcaseItem[];
  caseStudies: ShowcaseItem[];
}

export interface EditionConfigSource {
  locale?: string;
  currency?: string;
  pricingVersion?: string;
  pricingEffectiveFrom?: string;
  dayRate?: string;
  minimumImplementation?: string;
  minimumMaintenance?: string;
  roundingMultiple?: string;
  complexityFactorsJson?: string;
  maintenanceBracketsJson?: string;
  expansionDiscountTiersJson?: string;
  catalogJson?: string;
  landingContentJson?: string;
  productShowcaseJson?: string;
  caseStudiesJson?: string;
}

export const defaultSolutionCatalog: SolutionCatalogItem[] = [
  { key: "erp-ecommerce", name: "Sincronización ERP + ecommerce", category: "Integraciones", description: "Sincroniza pedidos, stock y estados.", defaultDays: 4, defaultComplexity: "medium" },
  { key: "payment-reconciliation", name: "Conciliación automática", category: "Finanzas", description: "Compara pagos, documentos y movimientos.", defaultDays: 5, defaultComplexity: "high" },
  { key: "daily-report", name: "Reporte operativo diario", category: "Datos", description: "Consolida y distribuye indicadores.", defaultDays: 2, defaultComplexity: "standard" },
];

export const defaultLandingContent: LandingContent = {
  primaryCtaLabel: "Analizar mi proceso",
  secondaryCtaLabel: "Agendar diagnóstico",
  secondaryCtaTarget: "diagnostic",
  trustItems: ["Desde el precio mínimo configurado", "Alcance transparente", "Crece módulo a módulo"],
  audienceLabels: ["ERP", "CRM", "Ecommerce", "Webservices", "Inteligencia artificial"],
  missionEyebrow: "Nuestra misión",
  missionTitle: "Menos tiempo, menos costos, más rentabilidad para tu pyme.",
  missionDescription: "Creemos que la automatización y la IA no deberían ser un privilegio de las grandes empresas. Construimos soluciones a tu alcance, con resultados medibles desde el primer módulo.",
  benefits: [
    { title: "Reducimos el tiempo", text: "Automatizamos las tareas repetitivas para que el equipo pueda concentrarse en hacer crecer el negocio." },
    { title: "Reducimos los costos", text: "Trabajamos con alcances claros, precios transparentes y resultados que pueden medirse." },
    { title: "Aumentamos la rentabilidad", text: "Diseñamos cada solución alrededor de capacidad liberada y valor concreto para la empresa." },
  ],
  solutionsEyebrow: "Qué resolvemos",
  solutionsTitle: "Menos fricción operativa. Más negocio.",
  solutionsDescription: "Partimos por el proceso que hoy más te frena y construimos una solución acotada, medible y preparada para crecer.",
  capabilities: [
    { title: "Procesos que se ejecutan solos", text: "Conectamos tareas repetitivas para eliminar traspasos manuales, errores y esperas innecesarias.", tag: "Automatización" },
    { title: "Sistemas que por fin conversan", text: "Integramos ERP, CRM, ecommerce y herramientas internas mediante APIs y webservices oficiales.", tag: "Integraciones" },
    { title: "IA aplicada a trabajo real", text: "Clasificación, extracción y asistencia donde produce un ahorro medible, siempre con control humano.", tag: "Inteligencia artificial" },
    { title: "Datos ordenados y disponibles", text: "Centralizamos información crítica para que tu equipo decida con una fuente confiable.", tag: "Datos" },
    { title: "Resultados visibles", text: "Medimos horas ahorradas, capacidad liberada y efecto operativo.", tag: "Eficiencia" },
    { title: "Seguridad desde el diseño", text: "Permisos, auditoría y manejo seguro de credenciales forman parte del producto.", tag: "Confianza" },
  ],
  proofPanel: {
    enabled: true,
    ariaLabel: "Vista de ejemplo del centro de operaciones",
    eyebrow: "Centro de operaciones",
    title: "Resumen de automatizaciones",
    metrics: [
      { label: "Horas recuperadas", value: 148, suffix: " h", thousands: false, accent: "lime" },
      { label: "Procesos este mes", value: 2840, suffix: "", thousands: true, accent: "azure" },
      { label: "Errores evitados", value: 97, suffix: "%", thousands: false, accent: "violet" },
      { label: "Flujos activos", value: 12, suffix: "", thousands: false, accent: "orange" },
    ],
    activities: [
      { name: "ERP → Facturación", detail: "Hace 3 minutos", status: "Activo" },
      { name: "Clasificador de solicitudes", detail: "Hace 8 minutos", status: "Activo" },
      { name: "Reporte diario automático", detail: "Programado 18:00", status: "Listo" },
    ],
  },
  productEyebrow: "El producto real",
  productTitle: "Así se ve tu operación, no una maqueta.",
  productDescription: "Estas son pantallas reales de la plataforma funcionando con datos de ejemplo: lo mismo que vas a usar tú.",
  floatingChat: {
    enabled: true,
    title: "WhatsApp · Automatizado",
    incoming: "Hola, ¿tienen hora para mañana?",
    outgoing: "Sí, tenemos 10:00 y 15:30.",
    status: "respondiendo solo...",
  },
  caseStudyEyebrow: "Capacidad real",
  caseStudyTitle: "También construimos sistemas más profundos.",
  caseStudyDescription: "Un ejemplo real en producción con indicadores financieros y operación en vivo, construido a medida.",
  processEyebrow: "Cómo funciona",
  processTitle: "De un problema concreto a una mejora funcionando.",
  processDescription: "Sin proyectos eternos ni propuestas opacas. Avanzamos en bloques claros y comprobables.",
  processSteps: [
    { title: "Entendemos el cuello de botella", text: "Mapeamos personas, sistemas, volumen y horas para encontrar la oportunidad de mayor impacto." },
    { title: "Cotizamos con reglas claras", text: "Estimamos jornadas, complejidad, implementación y mantención. Los costos externos van separados." },
    { title: "Implementamos y expandimos", text: "Medimos el resultado y agregamos nuevos módulos con descuentos progresivos por expansión." },
  ],
  pricingEyebrow: "Precios transparentes",
  pricingTitle: "Empieza pequeño. Escala con confianza.",
  pricingBenefits: ["Mantención desde el mínimo configurado", "Alcance y reglas de precio documentadas", "Servidores, mensajería y licencias siempre separados"],
  finalCtaTitle: "¿Qué proceso le quita más tiempo a tu equipo?",
  finalCtaDescription: "Cuéntanos cómo funciona hoy. Recibirás una evaluación preliminar, clara y sin compromiso.",
  diagnosticEyebrow: "Sin compromiso · Menos de 1 minuto",
  diagnosticTitle: "Encontremos la oportunidad con mayor impacto.",
  diagnosticDescription: "Déjanos tus datos y te contactamos. Los detalles los afinamos juntos en la conversación.",
};

export const defaultProductShowcase: ShowcaseItem[] = [
  { key: "dashboard", imagePath: "/screenshots/dashboard.jpg", pathLabel: "/admin/dashboard", alt: "Dashboard ejecutivo con MRR, pipeline comercial y alertas", width: 1517, height: 703 },
  { key: "accounts", imagePath: "/screenshots/accounts.jpg", pathLabel: "/admin/accounts", alt: "Listado de cuentas con estado, industria y MRR", width: 1517, height: 703 },
  { key: "quote", imagePath: "/screenshots/quote.jpg", pathLabel: "/admin/quotes/new", alt: "Cotizador con descuento de expansión aplicado en tiempo real", width: 1517, height: 703 },
  { key: "crm", imagePath: "/screenshots/crm.jpg", pathLabel: "/admin/crm", alt: "Pipeline de CRM con leads, etapa y score de oportunidades", width: 1517, height: 703 },
];

export const defaultCaseStudies: ShowcaseItem[] = [
  { key: "operations", imagePath: "/screenshots/cmtop-operativos.jpg", pathLabel: "cmtop.vercel.app/operativos", alt: "Agenda de operativos por comuna con estado de asignación", width: 1517, height: 703 },
  { key: "ebitda", imagePath: "/screenshots/cmtop-ebitda.jpg", pathLabel: "cmtop.vercel.app/dashboards", alt: "Dashboard de EBITDA operacional comparado mes a mes", width: 1366, height: 577 },
];

function parsePositiveNumber(value: string | undefined, fallback: number, label: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} debe ser un número positivo.`);
  return parsed;
}

function parseJson(value: string | undefined, fallback: unknown, label: string) {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} debe contener JSON válido.`);
  }
}

export function createEditionConfig(source: EditionConfigSource = {}): EditionConfig {
  const pricing = pricingRulesSchema.parse({
    version: source.pricingVersion || currentPricingRules.version,
    effectiveFrom: source.pricingEffectiveFrom || currentPricingRules.effectiveFrom,
    currency: (source.currency || currentPricingRules.currency).toUpperCase(),
    dayRate: parsePositiveNumber(source.dayRate, currentPricingRules.dayRate, "PRICING_DAY_RATE"),
    minimumImplementation: parsePositiveNumber(source.minimumImplementation, currentPricingRules.minimumImplementation, "PRICING_MINIMUM_IMPLEMENTATION"),
    minimumMaintenance: parsePositiveNumber(source.minimumMaintenance, currentPricingRules.minimumMaintenance, "PRICING_MINIMUM_MAINTENANCE"),
    roundingMultiple: parsePositiveNumber(source.roundingMultiple, currentPricingRules.roundingMultiple, "PRICING_ROUNDING_MULTIPLE"),
    complexityFactors: parseJson(source.complexityFactorsJson, currentPricingRules.complexityFactors, "PRICING_COMPLEXITY_FACTORS_JSON") as Record<ComplexityKey, number>,
    maintenanceBrackets: parseJson(source.maintenanceBracketsJson, currentPricingRules.maintenanceBrackets, "PRICING_MAINTENANCE_BRACKETS_JSON"),
    expansionDiscountTiers: parseJson(source.expansionDiscountTiersJson, currentPricingRules.expansionDiscountTiers, "PRICING_EXPANSION_DISCOUNT_TIERS_JSON"),
  });
  const catalog = z.array(catalogItemSchema).min(1).max(100).parse(
    parseJson(source.catalogJson, defaultSolutionCatalog, "SOLUTION_CATALOG_JSON"),
  );
  const landingOverrides = z.record(z.string(), z.unknown()).parse(
    parseJson(source.landingContentJson, {}, "LANDING_CONTENT_JSON"),
  );
  const landing = landingContentSchema.parse({ ...defaultLandingContent, ...landingOverrides });
  const productShowcase = z.array(showcaseItemSchema).max(12).parse(
    parseJson(source.productShowcaseJson, defaultProductShowcase, "PRODUCT_SHOWCASE_JSON"),
  );
  const caseStudies = z.array(showcaseItemSchema).max(12).parse(
    parseJson(source.caseStudiesJson, defaultCaseStudies, "CASE_STUDIES_JSON"),
  );
  const locale = z.string().trim().min(2).max(35).parse(source.locale || "es-CL");
  return { locale, pricing, catalog, landing, productShowcase, caseStudies };
}
