import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createPlan,
  configureDeploymentDomain,
  deploymentPaths,
  environmentFromEdition,
  operatorOnlyKeys,
  parseEnv,
  readJson,
  secretSkeleton,
  sensitiveRuntimeKeys,
  serializeEnv,
  validateDeployment,
  validateProvisioningReadiness,
} from "./provisioning-core.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const binExtension = isWindows ? ".cmd" : "";
const nodeCommand = process.execPath;
const localVercelCommand = join(projectRoot, "node_modules", ".bin", `vercel${binExtension}`);
const templateDeploymentPath = join(projectRoot, "editions", "_template", "deployment.json");

function toolFromPath(path) {
  if (!path || !existsSync(path)) return undefined;
  if (/\.[cm]?js$/i.test(path)) return { command: nodeCommand, prefix: [path] };
  if (/\.cmd$/i.test(path)) {
    const shim = readFileSync(path, "utf8");
    const match = shim.match(/%dp0%\\([^"\r\n]+\.[cm]?js)/i);
    if (!match) return undefined;
    return { command: nodeCommand, prefix: [resolve(dirname(path), match[1])] };
  }
  return { command: path, prefix: [] };
}

function resolveVercelTool() {
  if (process.env.VERCEL_CLI_PATH) return toolFromPath(resolve(process.env.VERCEL_CLI_PATH));
  if (existsSync(localVercelCommand)) return toolFromPath(localVercelCommand);
  const locator = spawnSync(isWindows ? "where.exe" : "which", ["vercel"], { encoding: "utf8", windowsHide: true });
  const located = locator.status === 0 ? String(locator.stdout).split(/\r?\n/).find(Boolean) : undefined;
  return located ? toolFromPath(located) : undefined;
}

const supabaseTool = { command: nodeCommand, prefix: [join(projectRoot, "node_modules", "supabase", "dist", "supabase.js")] };
const npmTool = { command: nodeCommand, prefix: [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")] };
const vercelTool = resolveVercelTool();

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

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readSecrets(path, { required = false } = {}) {
  if (!existsSync(path)) {
    if (required) fail(`Falta ${relative(projectRoot, path)}. Ejecuta provision:prepare.`);
    return {};
  }
  return parseEnv(readFileSync(path, "utf8"));
}

function writeSecrets(path, values) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeEnv(values), { encoding: "utf8", mode: 0o600 });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    input: options.input,
    shell: false,
    windowsHide: true,
  });
  if (result.error) fail(`${options.label ?? "Comando"}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "sin detalle").trim();
    fail(`${options.label ?? "Comando"} falló${detail ? `: ${detail}` : "."}`);
  }
  return { stdout: String(result.stdout ?? "").trim(), stderr: String(result.stderr ?? "").trim() };
}

function runTool(tool, args, options = {}) {
  if (!tool) fail(`${options.label ?? "Herramienta"}: ejecutable no disponible.`);
  return run(tool.command, [...tool.prefix, ...args], options);
}

function cliArgs(base, deployment) {
  const args = [...base];
  if (deployment.vercel.scope) args.push("--scope", deployment.vercel.scope);
  return args;
}

function vercelEnv(deployment, secrets) {
  return {
    ...(secrets.VERCEL_TOKEN ? { VERCEL_TOKEN: secrets.VERCEL_TOKEN } : {}),
    ...(deployment.vercel.orgId ? { VERCEL_ORG_ID: deployment.vercel.orgId } : {}),
    ...(deployment.vercel.projectId ? { VERCEL_PROJECT_ID: deployment.vercel.projectId } : {}),
  };
}

function supabaseEnv(secrets) {
  return {
    ...(secrets.SUPABASE_ACCESS_TOKEN ? { SUPABASE_ACCESS_TOKEN: secrets.SUPABASE_ACCESS_TOKEN } : {}),
    ...(secrets.SUPABASE_DB_PASSWORD ? { SUPABASE_DB_PASSWORD: secrets.SUPABASE_DB_PASSWORD } : {}),
  };
}

function findStringByKeys(value, keys) {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (keys.includes(key) && typeof child === "string" && child) return child;
  }
  for (const child of Object.values(value)) {
    const found = findStringByKeys(child, keys);
    if (found) return found;
  }
  return undefined;
}

function parseJsonOutput(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    fail(`${label} no devolvió JSON interpretable.`);
  }
}

function apiKeyValue(keys, namePatterns) {
  if (keys && !Array.isArray(keys) && typeof keys === "object") {
    for (const [key, value] of Object.entries(keys)) {
      if (namePatterns.some((pattern) => key.toLowerCase().includes(pattern)) && typeof value === "string" && value) return value;
    }
  }
  const list = Array.isArray(keys) ? keys : Array.isArray(keys?.keys) ? keys.keys : Object.values(keys ?? {});
  for (const item of list) {
    const name = String(item?.name ?? item?.type ?? "").toLowerCase();
    if (!namePatterns.some((pattern) => name.includes(pattern))) continue;
    const value = item?.api_key ?? item?.key ?? item?.value;
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function loadTarget(slug, { requireSecrets = false } = {}) {
  const paths = deploymentPaths(projectRoot, slug);
  const edition = readJson(paths.edition);
  const deployment = validateDeployment(readJson(paths.deployment), slug);
  if (edition.slug !== slug) fail(`edition.slug debe ser ${slug}.`);
  const secrets = readSecrets(paths.secrets, { required: requireSecrets });
  return { paths, edition, deployment, secrets };
}

function recordReport(path, slug, phase, details = {}) {
  const previous = existsSync(path) ? readJson(path) : { schemaVersion: 1, slug, phases: [] };
  previous.phases = Array.isArray(previous.phases) ? previous.phases : [];
  previous.phases.push({ phase, completedAt: new Date().toISOString(), ...details });
  writeJson(path, previous);
}

function ensureEditionValid(path) {
  run(nodeCommand, [join(projectRoot, "scripts", "edition-kit.mjs"), "validate", "--file", relative(projectRoot, path)], { label: "Validación de edición" });
}

function ensureCli(tool, name) {
  if (!tool || !existsSync(tool.command) || tool.prefix.some((path) => !existsSync(path))) {
    fail(`${name} no está disponible. Instálalo fuera del proyecto o define VERCEL_CLI_PATH con su ruta.`);
  }
}

function prepare(args) {
  const slug = args.slug;
  const paths = deploymentPaths(projectRoot, slug);
  if (!existsSync(paths.edition)) fail(`Primero crea editions/${slug}/edition.json con edition:create.`);
  ensureEditionValid(paths.edition);
  if (existsSync(paths.deployment) && !args.force) fail(`${relative(projectRoot, paths.deployment)} ya existe; usa --force para reemplazarlo.`);
  if (!args["app-url"]) fail("--app-url es obligatorio y debe ser la URL HTTPS final.");
  const deployment = structuredClone(readJson(templateDeploymentPath));
  deployment.slug = slug;
  deployment.appUrl = args["app-url"];
  deployment.vercel.projectName = args["vercel-project"] || slug;
  deployment.vercel.scope = args["vercel-scope"] || "";
  const appHostname = new URL(deployment.appUrl).hostname;
  deployment.vercel.customDomain = args.domain || (appHostname.endsWith(".vercel.app") ? "" : appHostname);
  deployment.supabase.projectName = args["supabase-project"] || slug;
  deployment.supabase.organizationId = args["supabase-org-id"] || "";
  deployment.supabase.region = args["supabase-region"] || "sa-east-1";
  deployment.supabase.size = args["supabase-size"] || "micro";
  validateDeployment(deployment, slug);
  writeJson(paths.deployment, deployment);
  if (!existsSync(paths.secrets)) writeSecrets(paths.secrets, secretSkeleton);
  process.stdout.write(`Aprovisionamiento preparado para ${slug}.\nPlan: ${relative(projectRoot, paths.deployment)}\nSecretos locales: ${relative(projectRoot, paths.secrets)} (ignorado por Git).\n`);
}

function validateTarget(args) {
  const stage = args.stage || "config";
  const { paths, deployment, secrets } = loadTarget(args.slug);
  ensureEditionValid(paths.edition);
  const { errors, warnings } = validateProvisioningReadiness(deployment, secrets, stage);
  for (const warning of warnings) process.stdout.write(`ADVERTENCIA: ${warning}\n`);
  if (errors.length) fail(errors.join("\n"));
  process.stdout.write(`Aprovisionamiento ${args.slug} válido para etapa ${stage}.\n`);
}

function showPlan(args) {
  const { deployment } = loadTarget(args.slug);
  process.stdout.write(`${createPlan(deployment).join("\n")}\n`);
}

function configureDomain(args) {
  if (!args.domain) fail("--domain es obligatorio y debe indicar el dominio ya adquirido, sin https://.");
  const target = loadTarget(args.slug);
  const deployment = configureDeploymentDomain(target.deployment, args.domain);
  writeJson(target.paths.deployment, deployment);
  process.stdout.write([
    `Dominio preparado para ${deployment.slug}: ${deployment.appUrl}`,
    "No se modificó ningún servicio externo.",
    `Siguiente paso: npm run provision:apply -- --slug ${deployment.slug} --phase domain --confirm ${deployment.slug}`,
  ].join("\n") + "\n");
}

function prepareSupabaseWorkspace(paths, deployment) {
  const workRoot = join(paths.work, "supabase-project");
  const targetSupabase = join(workRoot, "supabase");
  mkdirSync(targetSupabase, { recursive: true });
  cpSync(join(projectRoot, "supabase", "migrations"), join(targetSupabase, "migrations"), { recursive: true, force: true });
  const sourceConfig = readFileSync(join(projectRoot, "supabase", "config.toml"), "utf8");
  const appRoot = deployment.appUrl.replace(/\/$/, "");
  const config = sourceConfig
    .replace(/^project_id\s*=.*$/m, `project_id = "${deployment.slug}"`)
    .replace(/^site_url\s*=.*$/m, `site_url = "${appRoot}/auth/set-password"`)
    .replace(/additional_redirect_urls\s*=\s*\[[\s\S]*?\]/m, `additional_redirect_urls = [\n  "${appRoot}/**",\n  "http://localhost:3000/**",\n  "http://127.0.0.1:3000/**"\n]`);
  writeFileSync(join(targetSupabase, "config.toml"), config, "utf8");
  return workRoot;
}

function applyInfrastructure(target) {
  ensureCli(supabaseTool, "Supabase CLI");
  ensureCli(vercelTool, "Vercel CLI");
  const { paths, deployment, secrets } = target;
  if (!deployment.supabase.projectRef) {
    const readiness = validateProvisioningReadiness(deployment, secrets, "create");
    if (readiness.errors.length) fail(readiness.errors.join("\n"));
    const result = runTool(supabaseTool, [
      "projects", "create", deployment.supabase.projectName,
      "--org-id", deployment.supabase.organizationId,
      "--db-password", secrets.SUPABASE_DB_PASSWORD,
      "--region", deployment.supabase.region,
      ...(deployment.supabase.size ? ["--size", deployment.supabase.size] : []),
      "--output", "json", "--yes",
    ], { env: supabaseEnv(secrets), label: "Creación del proyecto Supabase" });
    const created = parseJsonOutput(result.stdout, "Supabase");
    deployment.supabase.projectRef = findStringByKeys(created, ["ref", "id", "project_ref"])
      ?? fail("No se pudo obtener el project ref creado por Supabase.");
    writeJson(paths.deployment, deployment);
  }

  const apiKeysResult = runTool(supabaseTool, ["projects", "api-keys", "--project-ref", deployment.supabase.projectRef, "--output", "json"], {
    env: supabaseEnv(secrets), label: "Lectura de claves públicas de Supabase",
  });
  const keys = parseJsonOutput(apiKeysResult.stdout, "Supabase api-keys");
  secrets.NEXT_PUBLIC_SUPABASE_URL = `https://${deployment.supabase.projectRef}.supabase.co`;
  secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = apiKeyValue(keys, ["publishable", "anon"]) ?? secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  secrets.SUPABASE_SECRET_KEY = apiKeyValue(keys, ["secret"]) ?? secrets.SUPABASE_SECRET_KEY;
  secrets.SUPABASE_SERVICE_ROLE_KEY = apiKeyValue(keys, ["service_role", "service role"]) ?? secrets.SUPABASE_SERVICE_ROLE_KEY;
  writeSecrets(paths.secrets, { ...secretSkeleton, ...secrets });

  const vercelWork = join(paths.work, "vercel-link");
  mkdirSync(vercelWork, { recursive: true });
  if (!existsSync(join(vercelWork, "package.json"))) writeJson(join(vercelWork, "package.json"), { name: deployment.vercel.projectName, private: true });
  runTool(vercelTool, cliArgs(["link", "--yes", "--project", deployment.vercel.projectName], deployment), {
    cwd: vercelWork, env: vercelEnv(deployment, secrets), label: "Creación/enlace del proyecto Vercel",
  });
  const projectLink = readJson(join(vercelWork, ".vercel", "project.json"));
  deployment.vercel.projectId = projectLink.projectId ?? fail("Vercel no devolvió projectId.");
  deployment.vercel.orgId = projectLink.orgId ?? fail("Vercel no devolvió orgId.");
  writeJson(paths.deployment, deployment);
  recordReport(paths.report, deployment.slug, "infrastructure", {
    supabaseProjectRef: deployment.supabase.projectRef,
    vercelProjectId: deployment.vercel.projectId,
  });
  process.stdout.write("Infraestructura creada/enlazada sin modificar los enlaces locales de Impulsia.\n");
}

function applyDatabase(target) {
  ensureCli(supabaseTool, "Supabase CLI");
  const { paths, deployment, secrets } = target;
  const readiness = validateProvisioningReadiness(deployment, secrets, "database");
  if (readiness.errors.length) fail(readiness.errors.join("\n"));
  const workRoot = prepareSupabaseWorkspace(paths, deployment);
  const common = { env: supabaseEnv(secrets), cwd: workRoot };
  const passwordArgs = secrets.SUPABASE_DB_PASSWORD ? ["--password", secrets.SUPABASE_DB_PASSWORD] : [];
  runTool(supabaseTool, ["link", "--project-ref", deployment.supabase.projectRef, ...passwordArgs, "--workdir", workRoot, "--yes"], { ...common, label: "Enlace aislado de Supabase" });
  const dryRun = runTool(supabaseTool, ["db", "push", "--linked", "--dry-run", ...passwordArgs, "--workdir", workRoot], { ...common, label: "Dry-run de migraciones" });
  process.stdout.write(`${dryRun.stdout}\n`);
  runTool(supabaseTool, ["db", "push", "--linked", ...passwordArgs, "--workdir", workRoot, "--yes"], { ...common, label: "Aplicación de migraciones" });
  recordReport(paths.report, deployment.slug, "database", { projectRef: deployment.supabase.projectRef });
  process.stdout.write("Migraciones aplicadas sin seed de demostración.\n");
}

function applyAuth(target) {
  ensureCli(supabaseTool, "Supabase CLI");
  const { paths, deployment, secrets } = target;
  const readiness = validateProvisioningReadiness(deployment, secrets, "auth");
  if (readiness.errors.length) fail(readiness.errors.join("\n"));
  const workRoot = prepareSupabaseWorkspace(paths, deployment);
  const common = { env: supabaseEnv(secrets), cwd: workRoot };
  const diff = runTool(supabaseTool, ["config", "diff", "--project-ref", deployment.supabase.projectRef, "--workdir", workRoot], {
    ...common,
    label: "Revisión de configuración Auth de Supabase",
  });
  process.stdout.write(`${diff.stdout || "Sin cambios de configuración."}\n`);
  runTool(supabaseTool, ["config", "push", "--project-ref", deployment.supabase.projectRef, "--workdir", workRoot, "--yes"], {
    ...common,
    label: "Configuración Auth de Supabase",
  });
  recordReport(paths.report, deployment.slug, "auth", { projectRef: deployment.supabase.projectRef, appUrl: deployment.appUrl });
  process.stdout.write("Configuración Auth aplicada después de revisar el diff.\n");
}

function applyEnvironment(target) {
  ensureCli(vercelTool, "Vercel CLI");
  const { paths, edition, deployment, secrets } = target;
  const readiness = validateProvisioningReadiness(deployment, secrets, "environment");
  if (readiness.errors.length) fail(readiness.errors.join("\n"));
  const values = environmentFromEdition(edition, deployment, secrets);
  const targetEnv = vercelEnv(deployment, secrets);
  for (const [key, value] of Object.entries(values)) {
    // Vercel no acepta valores vacíos (p. ej. una edición todavía sin RUT): se omiten.
    if (operatorOnlyKeys.has(key) || String(value) === "") continue;
    const visibility = sensitiveRuntimeKeys.has(key) ? "--sensitive" : "--no-sensitive";
    runTool(vercelTool, cliArgs(["env", "add", key, "production", visibility, "--force", "--yes"], deployment), {
      env: targetEnv, input: String(value), label: `Carga de variable ${key}`,
    });
    process.stdout.write(`Variable ${key} configurada.\n`);
  }
  recordReport(paths.report, deployment.slug, "environment", { variables: Object.keys(values).length });
}

function applyDeploy(target) {
  ensureCli(vercelTool, "Vercel CLI");
  const { paths, deployment, secrets } = target;
  const readiness = validateProvisioningReadiness(deployment, secrets, "deploy");
  if (readiness.errors.length) fail(readiness.errors.join("\n"));
  const result = runTool(vercelTool, cliArgs(["deploy", "--prod", "--yes", "--cwd", projectRoot], deployment), {
    env: vercelEnv(deployment, secrets), label: "Despliegue de producción",
  });
  // Las versiones nuevas de la CLI terminan con un bloque JSON: se toma la última URL de vercel.app.
  const deploymentUrl = result.stdout.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi)?.at(-1) ?? result.stdout.trim().split(/\r?\n/).at(-1);
  recordReport(paths.report, deployment.slug, "deploy", { deploymentUrl });
  process.stdout.write(`Despliegue creado: ${deploymentUrl}\n`);
}

function applyDomain(target) {
  ensureCli(vercelTool, "Vercel CLI");
  const { paths, deployment, secrets } = target;
  if (!deployment.vercel.projectId || !deployment.vercel.orgId) fail("Faltan vercel.projectId/vercel.orgId; ejecuta primero la fase infrastructure.");
  const domain = deployment.vercel.customDomain;
  if (!domain) {
    process.stdout.write("No hay dominio personalizado; fase omitida.\n");
    return;
  }
  runTool(vercelTool, cliArgs(["domains", "add", domain, deployment.vercel.projectName], deployment), {
    env: vercelEnv(deployment, secrets), label: "Asignación de dominio",
  });
  const inspection = runTool(vercelTool, cliArgs(["domains", "inspect", domain], deployment), {
    env: vercelEnv(deployment, secrets), label: "Inspección de dominio",
  });
  recordReport(paths.report, deployment.slug, "domain", { domain });
  process.stdout.write(`${inspection.stdout}\n`);
}

async function verifyTarget(target) {
  const { paths, deployment } = target;
  const base = deployment.appUrl.replace(/\/$/, "");
  const results = [];
  for (const path of ["/", "/diagnostico", "/login"]) {
    const response = await fetch(`${base}${path}`, { redirect: "manual" });
    results.push({ path, status: response.status });
    if (response.status !== 200) fail(`${path} respondió ${response.status}; se esperaba 200.`);
  }
  const admin = await fetch(`${base}/admin/dashboard`, { redirect: "manual" });
  const location = admin.headers.get("location") ?? "";
  results.push({ path: "/admin/dashboard", status: admin.status, location });
  if (![307, 308].includes(admin.status) || !location.includes("/login")) fail("/admin/dashboard no redirigió al login.");
  recordReport(paths.report, deployment.slug, "verify", { baseUrl: base, results });
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

function rehearse(args) {
  const target = args.template
    ? {
        paths: {
          ...deploymentPaths(projectRoot, "template-preview"),
          edition: join(projectRoot, "editions", "_template", "edition.json"),
          deployment: templateDeploymentPath,
        },
        edition: readJson(join(projectRoot, "editions", "_template", "edition.json")),
        deployment: validateDeployment(readJson(templateDeploymentPath), "cliente-b2b"),
        secrets: {},
      }
    : loadTarget(args.slug);
  ensureEditionValid(target.paths.edition);
  const buildEnvironment = environmentFromEdition(target.edition, target.deployment, {
    NEXT_PUBLIC_SUPABASE_URL: "https://rehearsal.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_rehearsal",
    SUPABASE_SECRET_KEY: "sb_secret_rehearsal",
  });
  runTool(npmTool, ["run", "build"], {
    env: buildEnvironment,
    label: `Build de ensayo ${target.edition.slug}`,
  });
  recordReport(target.paths.report, target.edition.slug, "rehearse", {
    template: Boolean(args.template),
    variables: Object.keys(buildEnvironment).length,
  });
  process.stdout.write(`Ensayo aprobado para ${target.edition.slug}: build de producción con ${Object.keys(buildEnvironment).length} variables derivadas.\n`);
}

async function apply(args) {
  const slug = args.slug;
  const phase = args.phase;
  if (args.confirm !== slug) fail(`La operación externa requiere --confirm ${slug}.`);
  const phases = phase === "all" ? ["infrastructure", "database", "auth", "environment", "deploy", "domain", "verify"] : [phase];
  const allowed = new Set(["infrastructure", "database", "auth", "environment", "deploy", "domain", "verify"]);
  if (phases.some((item) => !allowed.has(item))) fail("--phase debe ser infrastructure, database, auth, environment, deploy, domain, verify o all.");
  for (const item of phases) {
    const target = loadTarget(slug, { requireSecrets: true });
    if (item === "infrastructure") applyInfrastructure(target);
    else if (item === "database") applyDatabase(target);
    else if (item === "auth") applyAuth(target);
    else if (item === "environment") applyEnvironment(target);
    else if (item === "deploy") applyDeploy(target);
    else if (item === "domain") applyDomain(target);
    else await verifyTarget(target);
  }
}

const args = parseArguments(process.argv.slice(2));
const command = args._[0] ?? "plan";

if (command === "prepare") prepare(args);
else if (command === "domain") configureDomain(args);
else if (command === "validate") validateTarget(args);
else if (command === "plan") showPlan(args);
else if (command === "rehearse") rehearse(args);
else if (command === "verify") await verifyTarget(loadTarget(args.slug));
else if (command === "apply") await apply(args);
else fail("Comando desconocido. Usa prepare, validate, plan, rehearse, apply o verify.");
