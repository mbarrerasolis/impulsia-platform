import { describe, expect, it } from "vitest";
import { buildQuotePrefillPath, parseQuotePrefill, quotePrefillNotesMaxChars } from "./quote-prefill";

const toParams = (path: string) => Object.fromEntries(new URL(path, "https://impulsialabs.cl").searchParams);

describe("quote prefill", () => {
  it("arma y lee la misma propuesta", () => {
    const prefill = { leadId: "lead-9", name: "Integración ERP + ecommerce", estimatedDays: 4.5, complexity: "high" as const, thirdPartyMonthlyCost: 25_000, notes: "Pedidos & stock" };
    const path = buildQuotePrefillPath(prefill);

    expect(path.startsWith("/admin/quotes/new?")).toBe(true);
    expect(parseQuotePrefill(toParams(path))).toEqual(prefill);
  });

  it("recorta notas largas en la URL", () => {
    const path = buildQuotePrefillPath({ name: "Reporte diario", estimatedDays: 2, complexity: "standard", thirdPartyMonthlyCost: 0, notes: "x".repeat(5_000) });
    expect(parseQuotePrefill(toParams(path))?.notes).toHaveLength(quotePrefillNotesMaxChars);
  });

  it("ignora prellenados incompletos o inválidos", () => {
    expect(parseQuotePrefill({})).toBeNull();
    expect(parseQuotePrefill({ name: "Reporte", days: "-1", complexity: "medium" })).toBeNull();
    expect(parseQuotePrefill({ name: "Reporte", days: "2", complexity: "extrema" })).toBeNull();
    expect(parseQuotePrefill({ name: "Reporte", days: "2", complexity: "medium", leadId: "../x" })).toBeNull();
  });
});
