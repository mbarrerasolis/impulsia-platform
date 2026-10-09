import { z } from "zod";

/**
 * Perfil de negocio de una edición: a quién vende (B2B, B2C o ambos) y qué vende (servicios,
 * productos o ambos). Define qué módulos tienen sentido y cómo se nombran las cosas en la UI.
 */
export const businessModels = ["b2b", "b2c", "mixed"] as const;
export const businessOfferings = ["services", "products", "mixed"] as const;
export type BusinessModel = (typeof businessModels)[number];
export type BusinessOffering = (typeof businessOfferings)[number];

/** Landings sectoriales disponibles (páginas propias de una edición, p. ej. /salud). */
export const sectorLandings = ["salud", "comida"] as const;
export type SectorLanding = (typeof sectorLandings)[number];

export const moduleKeys = ["quotes", "subscriptions", "clientPortal", "whatsapp", "meetings", "store", "erp"] as const;
export type ModuleKey = (typeof moduleKeys)[number];

export const moduleLabels: Record<ModuleKey, string> = {
  quotes: "Cotizador por jornadas y reglas de precio",
  subscriptions: "Soluciones, mantención y cobranza",
  clientPortal: "Portal de clientes",
  whatsapp: "WhatsApp y asistente con IA",
  meetings: "Agenda de reuniones",
  store: "Tienda de productos",
  erp: "Conexión con ERP",
};

export interface BusinessProfile {
  model: BusinessModel;
  offering: BusinessOffering;
  modules: Record<ModuleKey, boolean>;
  sectorLandings: SectorLanding[];
}

const sellsServices = (offering: BusinessOffering) => offering !== "products";
const sellsProducts = (offering: BusinessOffering) => offering !== "services";

/** Módulos por defecto según lo que vende el negocio; el manifiesto puede ajustar cada uno. */
export function defaultModules(offering: BusinessOffering): Record<ModuleKey, boolean> {
  return {
    quotes: sellsServices(offering),
    subscriptions: sellsServices(offering),
    clientPortal: sellsServices(offering),
    whatsapp: true,
    meetings: sellsServices(offering),
    store: sellsProducts(offering),
    erp: false,
  };
}

const businessSourceSchema = z.object({
  model: z.enum(businessModels).default("b2b"),
  offering: z.enum(businessOfferings).default("services"),
}).default({ model: "b2b", offering: "services" });

const modulesSourceSchema = z.object({
  ...Object.fromEntries(moduleKeys.map((key) => [key, z.boolean().optional()])) as Record<ModuleKey, z.ZodOptional<z.ZodBoolean>>,
  sectorLandings: z.array(z.enum(sectorLandings)).max(sectorLandings.length).optional(),
}).strict().default({});

/** Reglas entre módulos: lo que exige cada uno para funcionar. */
export function moduleProblems(profile: Pick<BusinessProfile, "offering" | "modules">): string[] {
  const { modules, offering } = profile;
  const problems: string[] = [];
  if (modules.quotes && !sellsServices(offering)) problems.push("El cotizador por jornadas requiere vender servicios (offering services o mixed).");
  if (modules.subscriptions && !modules.quotes) problems.push("Soluciones y cobranza requieren el cotizador (las soluciones nacen de una cotización aprobada).");
  if (modules.clientPortal && !modules.subscriptions) problems.push("El portal de clientes requiere soluciones y cobranza.");
  if (modules.store && !sellsProducts(offering)) problems.push("La tienda requiere vender productos (offering products o mixed).");
  if (modules.meetings && !modules.whatsapp) problems.push("La agenda de reuniones la ofrece el asistente de WhatsApp: activa whatsapp.");
  return problems;
}

/**
 * Lee `business` y `modules` del manifiesto. Sin `modules` usa los valores por defecto del tipo de
 * oferta, así las ediciones existentes (servicios B2B) siguen igual. Lanza error si la combinación
 * de módulos no es coherente.
 */
export function parseBusinessProfile(source: { business?: unknown; modules?: unknown } = {}): BusinessProfile {
  const business = businessSourceSchema.parse(source.business);
  const overrides = modulesSourceSchema.parse(source.modules);
  const defaults = defaultModules(business.offering);
  const modules = Object.fromEntries(moduleKeys.map((key) => [key, overrides[key] ?? defaults[key]])) as Record<ModuleKey, boolean>;
  const profile: BusinessProfile = { model: business.model, offering: business.offering, modules, sectorLandings: overrides.sectorLandings ?? [] };
  const problems = moduleProblems(profile);
  if (problems.length) throw new Error(`Módulos incoherentes en la edición: ${problems.join(" ")}`);
  return profile;
}

/** Textos que cambian según a quién se vende. */
export function businessVocabulary(model: BusinessModel) {
  return model === "b2c"
    ? { accounts: "Clientes", account: "Cliente", company: "Nombre" }
    : model === "mixed"
      ? { accounts: "Clientes y cuentas", account: "Cliente", company: "Empresa o nombre" }
      : { accounts: "Cuentas", account: "Cuenta", company: "Empresa" };
}
