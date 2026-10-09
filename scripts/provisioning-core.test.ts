import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  configureDeploymentDomain,
  environmentFromEdition,
  normalizeDomain,
  parseEnv,
  readJson,
  validateDeployment,
  validateProvisioningReadiness,
} from "./provisioning-core.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const edition = readJson(resolve(projectRoot, "editions", "_template", "edition.json"));
const deployment = readJson(resolve(projectRoot, "editions", "_template", "deployment.json"));

describe("provisioning core", () => {
  it("deriva una configuración de Vercel completa desde el manifiesto", () => {
    const values = environmentFromEdition(edition, deployment, {
      VERCEL_TOKEN: "operator-only",
      SUPABASE_ACCESS_TOKEN: "operator-only",
      UNRECOGNIZED_OPERATOR_SECRET: "must-not-upload",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    });

    expect(values.NEXT_PUBLIC_BRAND_NAME).toBe("Marca B2B");
    expect(values.NEXT_PUBLIC_APP_URL).toBe("https://cliente.example.com");
    expect(values.LANDING_CONTENT_JSON).toContain("Solicitar una evaluación");
    expect(values.SUPABASE_SECRET_KEY).toBe("sb_secret_test");
    expect(values.VERCEL_TOKEN).toBeUndefined();
    expect(values.SUPABASE_ACCESS_TOKEN).toBeUndefined();
    expect(values.UNRECOGNIZED_OPERATOR_SECRET).toBeUndefined();
  });

  it("analiza secretos sin truncar valores que contienen signos igual", () => {
    expect(parseEnv("TOKEN=abc==\nEMPTY=\n")).toEqual({ TOKEN: "abc==", EMPTY: "" });
  });

  it("impide desplegar sin identificadores ni credenciales de runtime", () => {
    const readiness = validateProvisioningReadiness(deployment, {}, "deploy");
    expect(readiness.errors).toContain("Falta supabase.projectRef; ejecuta primero la fase infrastructure.");
    expect(readiness.errors).toContain("Faltan vercel.projectId/vercel.orgId; ejecuta primero la fase infrastructure.");
    expect(readiness.errors).toContain("NEXT_PUBLIC_SUPABASE_URL es obligatorio.");
  });

  it("activa el asistente con IA sólo con su clave", () => {
    const withAi = { ...deployment, providers: { ...deployment.providers, ai: "anthropic" } };
    expect(environmentFromEdition(edition, withAi, {}).AI_PROVIDER).toBe("anthropic");
    expect(environmentFromEdition(edition, deployment, {}).AI_PROVIDER).toBe("disabled");
    expect(validateProvisioningReadiness(withAi, {}, "environment").errors).toContain("ANTHROPIC_API_KEY es obligatorio con providers.ai = anthropic.");
  });

  it("permite preparar Auth sin exigir la contraseña de Postgres", () => {
    const ready = {
      ...deployment,
      supabase: { ...deployment.supabase, projectRef: "project-existing" },
    };
    const readiness = validateProvisioningReadiness(ready, {}, "auth");
    expect(readiness.errors).toEqual([]);
    expect(readiness.warnings).toContain("SUPABASE_ACCESS_TOKEN vacío: la CLI debe tener una sesión iniciada.");
  });

  it("rechaza planes cruzados entre clientes", () => {
    expect(() => validateDeployment(deployment, "otro-cliente")).toThrow("deployment.slug debe ser otro-cliente");
  });

  it("prepara un dominio oficial sin perder los identificadores de infraestructura", () => {
    const existing = {
      ...deployment,
      vercel: { ...deployment.vercel, projectId: "prj_existing", orgId: "team_existing" },
      supabase: { ...deployment.supabase, projectRef: "project-existing" },
    };
    const configured = configureDeploymentDomain(existing, " ImpulsiaLabs.CL. ");

    expect(configured.appUrl).toBe("https://impulsialabs.cl");
    expect(configured.vercel.customDomain).toBe("impulsialabs.cl");
    expect(configured.vercel.projectId).toBe("prj_existing");
    expect(configured.supabase.projectRef).toBe("project-existing");
  });

  it("rechaza protocolos, rutas y dominios inconsistentes", () => {
    expect(() => normalizeDomain("https://impulsialabs.cl")).toThrow("sin protocolo");
    expect(() => normalizeDomain("impulsialabs.cl/admin")).toThrow("sin protocolo");
    expect(() => validateDeployment({
      ...deployment,
      appUrl: "https://otro.cl",
      vercel: { ...deployment.vercel, customDomain: "impulsialabs.cl" },
    })).toThrow("debe usar el dominio personalizado");
  });
});
