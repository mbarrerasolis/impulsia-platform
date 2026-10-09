import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const activeEditionPath = join(projectRoot, "config", "edition.json");
const templateEditionPath = join(projectRoot, "editions", "_template", "edition.json");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const currencyPattern = /^[A-Z]{3}$/;
const imagePattern = /^\/[A-Za-z0-9/_-]+\.(png|jpe?g|webp)$/i;
const forbiddenKeyPattern = /(password|secret|token|api.?key|access.?key|service.?role|private.?key)/i;

function fail(message) {
  throw new Error(message);
}

function parseArguments(values) {
  const result = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      result._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function readJson(path) {
  if (!existsSync(path)) fail(`No existe ${relative(projectRoot, path)}.`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`JSON inválido en ${relative(projectRoot, path)}: ${error instanceof Error ? error.message : "error desconocido"}`);
  }
}

function assertString(value, label, min = 2) {
  if (typeof value !== "string" || value.trim().length < min) fail(`${label} debe ser texto válido.`);
}

function assertPositive(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail(`${label} debe ser un número positivo.`);
}

function assertArray(value, label, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${label} debe tener entre ${min} y ${max} elementos.`);
}

function rejectSecrets(value, path = "edition") {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectSecrets(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeyPattern.test(key)) fail(`El manifiesto no puede contener credenciales: ${path}.${key}.`);
    rejectSecrets(child, `${path}.${key}`);
  }
}

function validateShowcase(items, label) {
  if (!Array.isArray(items) || items.length > 12) fail(`${label} debe ser una lista de hasta 12 capturas.`);
  for (const [index, item] of items.entries()) {
    assertString(item?.key, `${label}[${index}].key`);
    assertString(item?.alt, `${label}[${index}].alt`, 5);
    assertString(item?.pathLabel, `${label}[${index}].pathLabel`);
    if (typeof item?.imagePath !== "string" || !imagePattern.test(item.imagePath)) fail(`${label}[${index}].imagePath debe apuntar a una imagen local de /public.`);
    assertPositive(item.width, `${label}[${index}].width`);
    assertPositive(item.height, `${label}[${index}].height`);
    const assetPath = join(projectRoot, "public", item.imagePath.slice(1));
    if (!existsSync(assetPath)) fail(`Falta el activo ${item.imagePath} declarado en ${label}.`);
  }
}

function validateLanding(landing) {
  if (!landing || typeof landing !== "object" || Array.isArray(landing)) fail("landing es obligatorio.");
  const textKeys = [
    "primaryCtaLabel", "secondaryCtaLabel", "missionEyebrow", "missionTitle", "missionDescription",
    "solutionsEyebrow", "solutionsTitle", "solutionsDescription", "productEyebrow", "productTitle",
    "productDescription", "caseStudyEyebrow", "caseStudyTitle", "caseStudyDescription", "processEyebrow",
    "processTitle", "processDescription", "pricingEyebrow", "pricingTitle", "finalCtaTitle",
    "finalCtaDescription", "diagnosticEyebrow", "diagnosticTitle", "diagnosticDescription",
  ];
  for (const key of textKeys) assertString(landing[key], `landing.${key}`);
  if (!["diagnostic", "contact"].includes(landing.secondaryCtaTarget)) fail("landing.secondaryCtaTarget debe ser diagnostic o contact.");
  for (const [key, min, max] of [["trustItems", 1, 5], ["audienceLabels", 1, 8], ["pricingBenefits", 1, 6]]) {
    assertArray(landing[key], `landing.${key}`, min, max);
    landing[key].forEach((item, index) => assertString(item, `landing.${key}[${index}]`));
  }
  for (const [key, min, max] of [["benefits", 1, 6], ["processSteps", 1, 5]]) {
    assertArray(landing[key], `landing.${key}`, min, max);
    landing[key].forEach((item, index) => {
      assertString(item?.title, `landing.${key}[${index}].title`);
      assertString(item?.text, `landing.${key}[${index}].text`, 10);
    });
  }
  assertArray(landing.capabilities, "landing.capabilities", 1, 9);
  landing.capabilities.forEach((item, index) => {
    assertString(item?.title, `landing.capabilities[${index}].title`);
    assertString(item?.text, `landing.capabilities[${index}].text`, 10);
    assertString(item?.tag, `landing.capabilities[${index}].tag`);
  });
  if (typeof landing.proofPanel?.enabled !== "boolean") fail("landing.proofPanel.enabled debe ser booleano.");
  for (const key of ["ariaLabel", "eyebrow", "title"]) assertString(landing.proofPanel?.[key], `landing.proofPanel.${key}`);
  assertArray(landing.proofPanel.metrics, "landing.proofPanel.metrics", 1, 4);
  landing.proofPanel.metrics.forEach((item, index) => {
    assertString(item?.label, `landing.proofPanel.metrics[${index}].label`);
    if (!Number.isInteger(item?.value) || item.value < 0) fail(`landing.proofPanel.metrics[${index}].value debe ser un entero no negativo.`);
    if (typeof item?.suffix !== "string") fail(`landing.proofPanel.metrics[${index}].suffix debe ser texto.`);
    if (typeof item?.thousands !== "boolean") fail(`landing.proofPanel.metrics[${index}].thousands debe ser booleano.`);
    if (!["lime", "azure", "violet", "orange"].includes(item?.accent)) fail(`landing.proofPanel.metrics[${index}].accent no es válido.`);
  });
  assertArray(landing.proofPanel.activities, "landing.proofPanel.activities", 1, 4);
  landing.proofPanel.activities.forEach((item, index) => {
    for (const key of ["name", "detail", "status"]) assertString(item?.[key], `landing.proofPanel.activities[${index}].${key}`);
  });
  if (typeof landing.floatingChat?.enabled !== "boolean") fail("landing.floatingChat.enabled debe ser booleano.");
  for (const key of ["title", "incoming", "outgoing", "status"]) assertString(landing.floatingChat?.[key], `landing.floatingChat.${key}`);
}

// Mismas reglas que domain/config/business.ts (la app las vuelve a validar al cargar la edición).
const businessModels = ["b2b", "b2c", "mixed"];
const businessOfferings = ["services", "products", "mixed"];
const moduleKeys = ["quotes", "subscriptions", "clientPortal", "whatsapp", "meetings", "store", "erp"];
const sectorLandings = ["salud", "comida"];

function defaultModules(offering) {
  const services = offering !== "products";
  return { quotes: services, subscriptions: services, clientPortal: services, whatsapp: true, meetings: services, store: offering !== "services", erp: false, sectorLandings: [] };
}

function validateBusiness(edition) {
  const business = edition.business ?? { model: "b2b", offering: "services" };
  if (!businessModels.includes(business.model)) fail(`business.model debe ser ${businessModels.join(", ")}.`);
  if (!businessOfferings.includes(business.offering)) fail(`business.offering debe ser ${businessOfferings.join(", ")}.`);
  const source = edition.modules ?? {};
  for (const key of Object.keys(source)) if (![...moduleKeys, "sectorLandings"].includes(key)) fail(`modules.${key} no existe. Módulos: ${moduleKeys.join(", ")}.`);
  const modules = { ...defaultModules(business.offering), ...source };
  for (const key of moduleKeys) if (typeof modules[key] !== "boolean") fail(`modules.${key} debe ser booleano.`);
  if (!Array.isArray(modules.sectorLandings) || modules.sectorLandings.some((item) => !sectorLandings.includes(item))) fail(`modules.sectorLandings sólo admite: ${sectorLandings.join(", ")}.`);
  const services = business.offering !== "products";
  if (modules.quotes && !services) fail("El cotizador por jornadas requiere vender servicios (business.offering services o mixed).");
  if (modules.subscriptions && !modules.quotes) fail("modules.subscriptions requiere modules.quotes.");
  if (modules.clientPortal && !modules.subscriptions) fail("modules.clientPortal requiere modules.subscriptions.");
  if (modules.store && business.offering === "services") fail("La tienda requiere vender productos (business.offering products o mixed).");
  if (modules.meetings && !modules.whatsapp) fail("modules.meetings requiere modules.whatsapp.");
}

// Reglas básicas de domain/config/storefront.ts (la app valida el detalle al cargar la edición).
function validateStorefront(storefront, business) {
  if (storefront === undefined) return;
  if ((business?.offering ?? "services") === "services") fail("storefront requiere business.offering products o mixed.");
  for (const key of ["catalogEyebrow", "catalogTitle", "catalogDescription", "howToBuyTitle", "orderGreeting"]) assertString(storefront?.[key], `storefront.${key}`);
  assertArray(storefront.categories, "storefront.categories", 1, 20);
  assertArray(storefront.products, "storefront.products", 1, 500);
  assertArray(storefront.highlights, "storefront.highlights", 1, 4);
  assertArray(storefront.howToBuy, "storefront.howToBuy", 1, 4);
  const categories = new Set(storefront.categories.map((category, index) => {
    assertString(category?.key, `storefront.categories[${index}].key`);
    assertString(category?.name, `storefront.categories[${index}].name`);
    return category.key;
  }));
  const products = new Set();
  const skus = new Set();
  const claimSku = (sku, label) => {
    if (sku === undefined) return;
    if (typeof sku !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(sku)) fail(`${label} no es un SKU válido.`);
    if (skus.has(sku.toUpperCase())) fail(`SKU duplicado: ${sku}.`);
    skus.add(sku.toUpperCase());
  };
  storefront.products.forEach((product, index) => {
    claimSku(product.sku, `storefront.products[${index}].sku`);
    assertString(product?.key, `storefront.products[${index}].key`);
    assertString(product?.name, `storefront.products[${index}].name`);
    if (!categories.has(product.category)) fail(`storefront.products[${index}].category no existe: ${product.category}.`);
    if (products.has(product.key)) fail(`Producto duplicado: ${product.key}.`);
    if (product.net !== undefined) {
      for (const tier of ["base", "bulk"]) {
        const value = product.net?.[tier];
        if ((tier === "base" || value !== undefined) && (!Number.isInteger(value) || value <= 0)) fail(`storefront.products[${index}].net.${tier} debe ser un entero positivo (neto sin IVA).`);
      }
    }
    products.add(product.key);
    for (const [formatIndex, format] of (product.formats ?? []).entries()) {
      assertString(format?.label, `storefront.products[${index}].formats[${formatIndex}].label`, 1);
      claimSku(format.sku, `storefront.products[${index}].formats[${formatIndex}].sku`);
      if (format.price !== undefined && (!Number.isInteger(format.price) || format.price <= 0)) fail(`storefront.products[${index}].formats[${formatIndex}].price debe ser un entero positivo.`);
    }
  });
}

function validateEdition(edition, path) {
  if (edition?.schemaVersion !== 1) fail("schemaVersion debe ser 1.");
  if (typeof edition.slug !== "string" || !slugPattern.test(edition.slug)) fail("slug debe usar minúsculas, números y guiones.");
  rejectSecrets(edition);
  for (const key of ["name", "legalName", "tagline", "description", "contactEmail", "heroEyebrow", "heroTitle", "heroHighlight", "heroDescription", "whatsappMessage"]) assertString(edition.brand?.[key], `brand.${key}`);
  if (!String(edition.brand.contactEmail).includes("@")) fail("brand.contactEmail debe ser un email.");
  for (const key of ["primaryColor", "primaryDarkColor", "accentColor", "darkSurfaceColor"]) if (!colorPattern.test(edition.brand?.[key] ?? "")) fail(`brand.${key} debe usar #RRGGBB.`);
  assertString(edition.commerce?.locale, "commerce.locale");
  if (!currencyPattern.test(edition.commerce?.currency ?? "")) fail("commerce.currency debe ser un código ISO de tres letras.");
  for (const key of ["dayRate", "minimumImplementation", "minimumMaintenance", "roundingMultiple"]) assertPositive(edition.pricing?.[key], `pricing.${key}`);
  assertString(edition.pricing?.version, "pricing.version");
  assertString(edition.pricing?.effectiveFrom, "pricing.effectiveFrom");
  if (!Array.isArray(edition.catalog) || edition.catalog.length === 0) fail("catalog debe tener al menos una solución.");
  const keys = new Set();
  for (const [index, item] of edition.catalog.entries()) {
    for (const key of ["key", "name", "category", "description"]) assertString(item?.[key], `catalog[${index}].${key}`);
    assertPositive(item.defaultDays, `catalog[${index}].defaultDays`);
    if (keys.has(item.key)) fail(`Clave de catálogo duplicada: ${item.key}.`);
    keys.add(item.key);
  }
  validateBusiness(edition);
  validateStorefront(edition.storefront, edition.business);
  validateLanding(edition.landing);
  validateShowcase(edition.productShowcase, "productShowcase");
  validateShowcase(edition.caseStudies, "caseStudies");
  return `Edición ${edition.slug} válida (${relative(projectRoot, path)}).`;
}

function editionPath(slug) {
  if (!slugPattern.test(slug ?? "")) fail("--slug es obligatorio y debe usar minúsculas, números y guiones.");
  return join(projectRoot, "editions", slug, "edition.json");
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const args = parseArguments(process.argv.slice(2));
const command = args._[0] ?? "validate";

if (command === "validate") {
  const path = args.file ? resolve(projectRoot, args.file) : activeEditionPath;
  process.stdout.write(`${validateEdition(readJson(path), path)}\n`);
} else if (command === "create") {
  const target = editionPath(args.slug);
  if (existsSync(target)) fail(`La edición ${args.slug} ya existe; no se sobrescribió.`);
  const edition = structuredClone(readJson(templateEditionPath));
  edition.slug = args.slug;
  edition.brand.name = args.name || fail("--name es obligatorio.");
  edition.brand.legalName = args["legal-name"] || edition.brand.name;
  edition.brand.contactEmail = args.email || fail("--email es obligatorio.");
  if (args.currency) edition.commerce.currency = String(args.currency).toUpperCase();
  if (args.locale) edition.commerce.locale = args.locale;
  if (args.model || args.offering) {
    edition.business = { model: args.model || "b2b", offering: args.offering || "services" };
    edition.modules = defaultModules(edition.business.offering);
  }
  writeJson(target, edition);
  process.stdout.write(`${validateEdition(edition, target)} Personaliza el manifiesto y ejecuta edition:activate cuando esté aprobado.\n`);
} else if (command === "snapshot") {
  const source = readJson(activeEditionPath);
  const target = editionPath(args.slug || source.slug);
  if (existsSync(target) && !args.force) fail(`${relative(projectRoot, target)} ya existe; usa --force para reemplazarlo.`);
  validateEdition(source, activeEditionPath);
  writeJson(target, source);
  process.stdout.write(`Respaldo creado en ${relative(projectRoot, target)}.\n`);
} else if (command === "activate") {
  const sourcePath = editionPath(args.slug);
  const nextEdition = readJson(sourcePath);
  validateEdition(nextEdition, sourcePath);
  const currentEdition = readJson(activeEditionPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const historyPath = join(projectRoot, "editions", "_history", `${currentEdition.slug}-${timestamp}.json`);
  writeJson(historyPath, currentEdition);
  copyFileSync(sourcePath, activeEditionPath);
  process.stdout.write(`Edición ${nextEdition.slug} activada. Respaldo anterior: ${relative(projectRoot, historyPath)}.\n`);
} else {
  fail("Comando desconocido. Usa validate, create, snapshot o activate.");
}
