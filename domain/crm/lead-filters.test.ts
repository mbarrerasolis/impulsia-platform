import { describe, expect, it } from "vitest";
import { parseConversationFilters } from "@/domain/messaging/conversation-filters";
import { matchesLeadFilters, parseLeadFilters, sanitizeSearch } from "./lead-filters";

const lead = {
  name: "Camila Rojas", company: "Clínica Andes", email: "camila@andes.cl", phone: "+56 9 1234 5678",
  source: "web" as const, status: "new" as const, attribution: { utmSource: "ig", utmMedium: "bio" },
};

describe("parseLeadFilters", () => {
  it("acepta sólo valores conocidos y sanea la búsqueda", () => {
    expect(parseLeadFilters({ q: "  camila, (x)* ", source: "web", status: "nuevo", origin: "tiktok" }))
      .toEqual({ search: "camila x", source: "web", status: undefined, origin: undefined });
  });
});

describe("sanitizeSearch", () => {
  it("quita caracteres que alterarían el filtro de PostgREST", () => {
    expect(sanitizeSearch("a,b.c%d(e)")).toBe("a b.c d e");
    expect(sanitizeSearch("   ")).toBeUndefined();
  });
});

describe("matchesLeadFilters", () => {
  it("combina búsqueda, canal, etapa y origen", () => {
    expect(matchesLeadFilters(lead, { search: "andes", origin: "instagram", source: "web", status: "new" })).toBe(true);
    expect(matchesLeadFilters(lead, { origin: "facebook" })).toBe(false);
    expect(matchesLeadFilters(lead, { origin: "none" })).toBe(false);
    expect(matchesLeadFilters({ ...lead, attribution: undefined }, { origin: "none" })).toBe(true);
    expect(matchesLeadFilters(lead, { search: "pedro" })).toBe(false);
    expect(matchesLeadFilters(lead, { status: "lost" })).toBe(false);
  });
});

describe("parseConversationFilters", () => {
  it("busca un teléfono sólo por sus dígitos y valida la vista", () => {
    expect(parseConversationFilters({ q: "+55 62 9215-6715", view: "attention" })).toEqual({ view: "attention", search: "556292156715" });
    expect(parseConversationFilters({ q: "Agustin", view: "otra" })).toEqual({ view: undefined, search: "Agustin" });
  });
});
