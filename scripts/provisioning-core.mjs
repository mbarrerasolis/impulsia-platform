import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const supabaseRegions = new Set([
  "ap-east-1", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
  "ap-southeast-1", "ap-southeast-2", "ca-central-1", "eu-central-1",
  "eu-central-2", "eu-north-1", "eu-west-1", "eu-west-2", "eu-west-3",
  "sa-east-1", "us-east-1", "us-east-2", "us-west-1", "us-west-2",
]);

export const operatorOnlyKeys = new Set([
  "VERCEL_TOKEN",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
]);

export const sensitiveRuntimeKeys = new Set([
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FLOW_API_KEY",
  "FLOW_SECRET_KEY",
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_ACCESS_TOKEN",
  "SECRET_ENCRYPTION_KEY",
  "INSTAGRAM_ACCESS_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "CRON_SECRET",
  "WEBHOOK_SECRET",
]);

export const runtimeSecretKeys = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_WHATSAPP_NUMBER",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_GRAPH_VERSION",
  "FLOW_API_KEY",
  "FLOW_SECRET_KEY",
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "SECRET_ENCRYPTION_KEY",
  "INSTAGRAM_ACCESS_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "CRON_SECRET",
  "WEBHOOK_SECRET",
]);

export const secretSkeleton = {
  VERCEL_TOKEN: "",
  SUPABASE_ACCESS_TOKEN: "",
  SUPABASE_DB_PASSWORD: "",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  SUPABASE_SECRET_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  NEXT_PUBLIC_WHATSAPP_NUMBER: "",
  WHATSAPP_VERIFY_TOKEN: "",
  WHATSAPP_APP_SECRET: "",
  WHATSAPP_ACCESS_TOKEN: "",
  WHATSAPP_PHONE_NUMBER_ID: "",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "",
  WHATSAPP_GRAPH_VERSION: "",
  FLOW_API_KEY: "",
  FLOW_SECRET_KEY: "",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  SECRET_ENCRYPTION_KEY: "",
  OPENAI_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  CRON_SECRET: "",
  WEBHOOK_SECRET: "",
};

function fail(message) {
  throw new Error(message);
}

function assertString(value, label, { required = true } = {}) {
  if (typeof value !== "string" || (required && value.trim().length === 0)) {
    fail(`${label} debe ser texto${required ? " no vacío" : ""}.`);
  }
}

export function validateDeployment(deployment, expectedSlug) {
  if (deployment?.schemaVersion !== 1) fail("deployment.schemaVersion debe ser 1.");
  if (!slugPattern.test(deployment?.slug ?? "")) fail("deployment.slug no es válido.");
  if (expectedSlug && deployment.slug !== expectedSlug) fail(`deployment.slug debe ser ${expectedSlug}.`);
  let appUrl;
  try {
    appUrl = new URL(deployment.appUrl);
  } catch {
    fail("deployment.appUrl debe ser una URL absoluta.");
  }
  if (appUrl.protocol !== "https:") fail("deployment.appUrl debe usar HTTPS.");
  assertString(deployment.vercel?.projectName, "deployment.vercel.projectName");
  assertString(deployment.vercel?.scope ?? "", "deployment.vercel.scope", { required: false });
  assertString(deployment.vercel?.projectId ?? "", "deployment.vercel.projectId", { required: false });
  assertString(deployment.vercel?.orgId ?? "", "deployment.vercel.orgId", { required: false });
  assertString(deployment.vercel?.customDomain ?? "", "deployment.vercel.customDomain", { required: false });
  if (deployment.vercel?.customDomain) {
    const customDomain = normalizeDomain(deployment.vercel.customDomain);
    if (deployment.vercel.customDomain !== customDomain) fail("deployment.vercel.customDomain debe estar normalizado.");
    if (appUrl.hostname !== customDomain) fail("deployment.appUrl debe usar el dominio personalizado configurado.");
  }
  assertString(deployment.supabase?.projectName, "deployment.supabase.projectName");
  assertString(deployment.supabase?.organizationId ?? "", "deployment.supabase.organizationId", { required: false });
  assertString(deployment.supabase?.projectRef ?? "", "deployment.supabase.projectRef", { required: false });
  if (!supabaseRegions.has(deployment.supabase?.region)) fail("deployment.supabase.region no es una región soportada.");
  // Vacío = tamaño por defecto (obligatorio en organizaciones del plan gratuito, que no aceptan --size).
  assertString(deployment.supabase?.size ?? "", "deployment.supabase.size", { required: false });
  if (!["mock", "flow", "mercadopago"].includes(deployment.providers?.payment)) fail("deployment.providers.payment no es válido.");
  if (!["sandbox", "production"].includes(deployment.providers?.flowEnvironment)) fail("deployment.providers.flowEnvironment no es válido.");
  if (!["mock", "resend"].includes(deployment.providers?.email)) fail("deployment.providers.email no es válido.");
  if (typeof deployment.providers?.whatsappBotEnabled !== "boolean") fail("deployment.providers.whatsappBotEnabled debe ser booleano.");
  // Opcional (ediciones anteriores no lo tienen): asistente con IA (WhatsApp, chat del sitio y simulador).
  if (deployment.providers.ai !== undefined && !["disabled", "anthropic"].includes(deployment.providers.ai)) fail("deployment.providers.ai no es válido (disabled o anthropic).");
  return deployment;
}

export function normalizeDomain(value) {
  const domain = String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!domainPattern.test(domain)) {
    fail("El dominio debe ser un hostname válido, sin protocolo, ruta ni puerto.");
  }
  return domain;
}

export function configureDeploymentDomain(deployment, value) {
  const domain = normalizeDomain(value);
  const configured = structuredClone(deployment);
  configured.appUrl = `https://${domain}`;
  configured.vercel.customDomain = domain;
  return validateDeployment(configured, configured.slug);
}

export function readJson(path) {
  if (!existsSync(path)) fail(`No existe ${path}.`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`JSON inválido en ${path}: ${error instanceof Error ? error.message : "error desconocido"}`);
  }
}

export function parseEnv(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) fail(`Línea inválida en archivo de secretos: ${rawLine}`);
    const key = line.slice(0, separator).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) fail(`Variable inválida: ${key}`);
    result[key] = line.slice(separator + 1);
  }
  return result;
}

export function serializeEnv(values, heading = "Credenciales locales. Nunca versionar este archivo.") {
  return `# ${heading}\n${Object.entries(values).map(([key, value]) => `${key}=${value ?? ""}`).join("\n")}\n`;
}

export function environmentFromEdition(edition, deployment, secrets = {}) {
  validateDeployment(deployment, edition.slug);
  const publicValues = {
    APP_MODE: "supabase",
    NEXT_PUBLIC_APP_URL: deployment.appUrl,
    NEXT_PUBLIC_BRAND_NAME: edition.brand.name,
    NEXT_PUBLIC_BRAND_LEGAL_NAME: edition.brand.legalName,
    IMPULSIA_EDITION: edition.slug,
    NEXT_PUBLIC_BRAND_TAX_ID: edition.brand.taxId || "",
    NEXT_PUBLIC_BRAND_TAGLINE: edition.brand.tagline,
    NEXT_PUBLIC_BRAND_DESCRIPTION: edition.brand.description,
    NEXT_PUBLIC_BRAND_CONTACT_EMAIL: edition.brand.contactEmail,
    NEXT_PUBLIC_BRAND_HERO_EYEBROW: edition.brand.heroEyebrow,
    NEXT_PUBLIC_BRAND_HERO_TITLE: edition.brand.heroTitle,
    NEXT_PUBLIC_BRAND_HERO_HIGHLIGHT: edition.brand.heroHighlight,
    NEXT_PUBLIC_BRAND_HERO_DESCRIPTION: edition.brand.heroDescription,
    NEXT_PUBLIC_BRAND_PRIMARY_COLOR: edition.brand.primaryColor,
    NEXT_PUBLIC_BRAND_PRIMARY_DARK_COLOR: edition.brand.primaryDarkColor,
    NEXT_PUBLIC_BRAND_ACCENT_COLOR: edition.brand.accentColor,
    NEXT_PUBLIC_BRAND_DARK_SURFACE_COLOR: edition.brand.darkSurfaceColor,
    NEXT_PUBLIC_WHATSAPP_MESSAGE: edition.brand.whatsappMessage,
    NEXT_PUBLIC_COMMERCE_LOCALE: edition.commerce.locale,
    NEXT_PUBLIC_COMMERCE_CURRENCY: edition.commerce.currency,
    PRICING_VERSION: edition.pricing.version,
    PRICING_EFFECTIVE_FROM: edition.pricing.effectiveFrom,
    PRICING_DAY_RATE: String(edition.pricing.dayRate),
    PRICING_MINIMUM_IMPLEMENTATION: String(edition.pricing.minimumImplementation),
    PRICING_MINIMUM_MAINTENANCE: String(edition.pricing.minimumMaintenance),
    PRICING_ROUNDING_MULTIPLE: String(edition.pricing.roundingMultiple),
    PRICING_COMPLEXITY_FACTORS_JSON: JSON.stringify(edition.pricing.complexityFactors),
    PRICING_MAINTENANCE_BRACKETS_JSON: JSON.stringify(edition.pricing.maintenanceBrackets),
    PRICING_EXPANSION_DISCOUNT_TIERS_JSON: JSON.stringify(edition.pricing.expansionDiscountTiers),
    SOLUTION_CATALOG_JSON: JSON.stringify(edition.catalog),
    LANDING_CONTENT_JSON: JSON.stringify(edition.landing),
    PRODUCT_SHOWCASE_JSON: JSON.stringify(edition.productShowcase),
    CASE_STUDIES_JSON: JSON.stringify(edition.caseStudies),
    PAYMENT_PROVIDER: deployment.providers.payment,
    FLOW_ENVIRONMENT: deployment.providers.flowEnvironment,
    EMAIL_PROVIDER: deployment.providers.email,
    WHATSAPP_BOT_ENABLED: String(deployment.providers.whatsappBotEnabled),
    // Mismos valores que acepta lib/env.ts.
    AI_PROVIDER: deployment.providers.ai === "anthropic" ? "anthropic" : "disabled",
    SECRET_STORE_PROVIDER: "local-memory",
  };
  const runtimeSecrets = Object.fromEntries(
    Object.entries(secrets).filter(([key, value]) => runtimeSecretKeys.has(key) && !operatorOnlyKeys.has(key) && value !== ""),
  );
  return { ...publicValues, ...runtimeSecrets };
}

export function validateProvisioningReadiness(deployment, secrets, stage = "config") {
  validateDeployment(deployment);
  const errors = [];
  const warnings = [];
  const requireValue = (key, message = `${key} es obligatorio.`) => {
    if (!secrets[key]) errors.push(message);
  };

  if (stage === "create" || stage === "all") {
    if (!deployment.supabase.projectRef) {
      if (!deployment.supabase.organizationId) errors.push("Falta supabase.organizationId para crear el proyecto.");
      requireValue("SUPABASE_DB_PASSWORD");
    }
    if (!secrets.SUPABASE_ACCESS_TOKEN) warnings.push("SUPABASE_ACCESS_TOKEN vacío: la CLI debe tener una sesión iniciada.");
    if (!secrets.VERCEL_TOKEN) warnings.push("VERCEL_TOKEN vacío: la CLI debe tener una sesión iniciada.");
  }

  if (["database", "auth", "environment", "deploy", "all"].includes(stage) && !deployment.supabase.projectRef) {
    errors.push("Falta supabase.projectRef; ejecuta primero la fase infrastructure.");
  }
  if (["database", "all"].includes(stage)) requireValue("SUPABASE_DB_PASSWORD");
  if (["auth", "all"].includes(stage) && !secrets.SUPABASE_ACCESS_TOKEN) {
    warnings.push("SUPABASE_ACCESS_TOKEN vacío: la CLI debe tener una sesión iniciada.");
  }
  if (["environment", "deploy", "all"].includes(stage)) {
    requireValue("NEXT_PUBLIC_SUPABASE_URL");
    requireValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    if (!secrets.SUPABASE_SECRET_KEY && !secrets.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push("Falta SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY.");
    }
    if (!deployment.vercel.projectId || !deployment.vercel.orgId) {
      errors.push("Faltan vercel.projectId/vercel.orgId; ejecuta primero la fase infrastructure.");
    }
  }
  if (["environment", "deploy", "all"].includes(stage)) {
    if (deployment.providers.payment === "flow") {
      requireValue("FLOW_API_KEY");
      requireValue("FLOW_SECRET_KEY");
    }
    if (deployment.providers.email === "resend") {
      requireValue("RESEND_API_KEY");
      requireValue("EMAIL_FROM");
    }
    if (deployment.providers.ai === "anthropic") requireValue("ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY es obligatorio con providers.ai = anthropic.");
    if (deployment.providers.whatsappBotEnabled) {
      for (const key of ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_GRAPH_VERSION"]) requireValue(key);
    }
  }
  return { errors, warnings };
}

export function deploymentPaths(projectRoot, slug) {
  if (!slugPattern.test(slug ?? "")) fail("--slug es obligatorio y debe usar minúsculas, números y guiones.");
  return {
    edition: join(projectRoot, "editions", slug, "edition.json"),
    deployment: join(projectRoot, "editions", slug, "deployment.json"),
    secrets: join(projectRoot, ".impulsia-secrets", `${slug}.env`),
    report: join(projectRoot, ".impulsia-secrets", `${slug}.provision-report.json`),
    work: join(projectRoot, ".impulsia-secrets", "work", slug),
  };
}

export function createPlan(deployment) {
  const domainStep = deployment.vercel.customDomain
    ? `6. domain: asociar e inspeccionar ${deployment.vercel.customDomain}.`
    : "6. domain: omitido; se usará la URL asignada por Vercel.";
  return [
    "1. infrastructure: crear o enlazar proyectos Supabase y Vercel aislados.",
    `2. database: enlazar ${deployment.supabase.projectRef || "<project-ref-nuevo>"}, revisar db push --dry-run y aplicar migraciones sin seed.`,
    "3. auth: revisar config diff y aplicar URLs/redirects de Supabase Auth.",
    "4. environment: cargar configuración pública y secretos de runtime en Vercel Production.",
    "5. deploy: publicar una versión de producción usando los IDs del proyecto del cliente.",
    domainStep,
    `7. verify: comprobar ${deployment.appUrl}, diagnóstico, login y protección de /admin/dashboard.`,
  ];
}
