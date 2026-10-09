import { z } from "zod";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color hexadecimal de 6 dígitos.");

const brandSourceSchema = z.object({
  name: z.string().trim().min(2).max(60).default("ImpulsIA"),
  legalName: z.string().trim().min(2).max(120).default("ImpulsIA"),
  taxId: z.string().trim().regex(/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/, "Debe ser un RUT con formato 12.345.678-9.").optional(),
  tagline: z.string().trim().min(5).max(140).default("Automatización, integraciones e IA para empresas que quieren avanzar."),
  description: z.string().trim().min(20).max(240).default("Automatizamos procesos, integramos sistemas y aplicamos IA con soluciones de alcance claro."),
  /** Título de la portada en buscadores (≤ 60 caracteres, con la marca); si falta, `nombre | tagline`. */
  seoTitle: z.string().trim().min(10).max(60).optional(),
  /** Descripción para buscadores (≤ 160 caracteres); si falta, `description`. */
  seoDescription: z.string().trim().min(50).max(160).optional(),
  contactEmail: z.email().default("contacto@impulsialabs.cl"),
  /** Correos que reciben en copia los avisos internos al equipo (pedidos, leads, derivaciones). */
  notificationCc: z.array(z.email()).max(5).default([]),
  heroEyebrow: z.string().trim().min(3).max(80).default("Automatización hecha a tu medida"),
  heroTitle: z.string().trim().min(3).max(90).default("Tu empresa avanza."),
  heroHighlight: z.string().trim().min(3).max(90).default("El trabajo repetitivo no."),
  heroDescription: z.string().trim().min(20).max(360).default("Integramos tus sistemas, automatizamos procesos y aplicamos IA para reducir tiempo, bajar costos y aumentar la rentabilidad de tu pyme — con soluciones a tu alcance."),
  whatsappMessage: z.string().trim().min(10).max(240).default("Hola, quiero conversar sobre una solución para mi empresa."),
  primaryColor: colorSchema.default("#0f766e"),
  primaryDarkColor: colorSchema.default("#0b514d"),
  accentColor: colorSchema.default("#b8f74f"),
  darkSurfaceColor: colorSchema.default("#102e2f"),
  /** Perfiles públicos de la marca: se muestran en el pie y en los datos estructurados. Vacío = no se muestra. */
  social: z.object({
    instagram: z.url().optional(),
    facebook: z.url().optional(),
    linkedin: z.url().optional(),
    tiktok: z.url().optional(),
    youtube: z.url().optional(),
  }).default({}),
});

export type BrandConfig = z.infer<typeof brandSourceSchema> & {
  contactHref: string;
  primaryRgb: string;
  primaryDarkRgb: string;
  accentRgb: string;
};

export type BrandConfigSource = Partial<z.input<typeof brandSourceSchema>>;

function removeEmptyValues(source: BrandConfigSource) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== ""));
}

function hexToRgbChannels(color: string) {
  return [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16)).join(" ");
}

export function createBrandConfig(source: BrandConfigSource = {}): BrandConfig {
  const parsed = brandSourceSchema.parse(removeEmptyValues(source));
  return {
    ...parsed,
    contactHref: `mailto:${parsed.contactEmail}`,
    primaryRgb: hexToRgbChannels(parsed.primaryColor),
    primaryDarkRgb: hexToRgbChannels(parsed.primaryDarkColor),
    accentRgb: hexToRgbChannels(parsed.accentColor),
  };
}
