import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getServerEnv } from "@/lib/env";
import { environmentFromEdition, readJson } from "./provisioning-core.mjs";

const root = resolve(import.meta.dirname, "..");

/** Las variables que el kit sube a Vercel deben pasar la misma validación que la aplicación al arrancar. */
describe("variables del kit contra lib/env", () => {
  it.each(["distribuidorasecos"])("la edición %s genera una configuración válida", (slug) => {
    const edition = JSON.parse(readFileSync(resolve(root, "editions", slug, "edition.json"), "utf8"));
    const deployment = readJson(resolve(root, "editions", slug, "deployment.json"));
    const secrets = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk", SUPABASE_SECRET_KEY: "sk", ANTHROPIC_API_KEY: "a", RESEND_API_KEY: "r", EMAIL_FROM: "Tienda <a@b.cl>", FLOW_API_KEY: "f", FLOW_SECRET_KEY: "f" };
    for (const ai of ["disabled", "anthropic"]) {
      const values = environmentFromEdition(edition, { ...deployment, providers: { ...deployment.providers, ai } }, secrets);
      expect(() => getServerEnv(values as NodeJS.ProcessEnv)).not.toThrow();
    }
  });
});
