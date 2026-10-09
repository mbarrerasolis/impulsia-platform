import { describe, expect, it } from "vitest";
import { MemoryLeadRepository } from "@/repositories/memory/memory-lead-repository";
import { CreateLeadService, LeadRateLimitError } from "./create-lead";

describe("CreateLeadService", () => {
  it("valida, clasifica y persiste un diagnóstico", async () => {
    const service = new CreateLeadService(new MemoryLeadRepository());
    const lead = await service.execute({
      name: "Persona Demo",
      company: "Empresa Demo",
      email: "demo@example.com",
      rawNeedDescription: "Queremos automatizar la conciliación de pedidos y facturas.",
      systems: ["ERP", "Tienda online"],
      apiKnowledge: "unknown",
      peopleInvolved: 4,
      hoursPerMonth: 60,
      monthlyVolume: 500,
      primaryGoal: "Ahorrar tiempo",
      consentGiven: true
    });
    expect(lead.id).toBeTruthy();
    expect(lead.score).toBe(100);
    expect(lead.status).toBe("new");
  });

  it("acepta un diagnóstico mínimo sin descripción del proceso", async () => {
    const service = new CreateLeadService(new MemoryLeadRepository());
    const lead = await service.execute({
      name: "Persona Mínima",
      company: "Empresa Mínima",
      email: "minima@example.com",
      primaryGoal: "Ahorrar tiempo",
      consentGiven: true
    });
    expect(lead.rawNeedDescription).toBe("Por definir en la llamada de diagnóstico.");
    expect(lead.apiKnowledge).toBe("unknown");
    expect(lead.score).toBe(25);
  });

  it("guarda el origen de marketing y descarta uno mal formado sin rechazar el lead", async () => {
    const service = new CreateLeadService(new MemoryLeadRepository());
    const base = { name: "Persona Origen", company: "Empresa Origen", primaryGoal: "Otro", consentGiven: true };
    const attributed = await service.execute({ ...base, email: "origen@example.com", attribution: { utmSource: "Instagram", utmMedium: "bio" } });
    expect(attributed.source).toBe("web");
    expect(attributed.attribution).toEqual({ utmSource: "instagram", utmMedium: "bio" });
    const malformed = await service.execute({ ...base, email: "origen2@example.com", attribution: { utmSource: 42 } });
    expect(malformed.attribution).toBeUndefined();
  });
});

describe("CreateLeadService · topes anti-abuso", () => {
  const base = { name: "Persona Tope", company: "Empresa Tope", primaryGoal: "Ahorrar tiempo", consentGiven: true };

  it("normaliza el email a minúsculas y bloquea al superar el tope por email en 24 h", async () => {
    const service = new CreateLeadService(new MemoryLeadRepository(), { perEmailPerDay: 2, totalPerHour: 100 });
    const lead = await service.execute({ ...base, email: "  Tope@Example.COM " });
    expect(lead.email).toBe("tope@example.com");
    await service.execute({ ...base, email: "tope@example.com" });
    await expect(service.execute({ ...base, email: "TOPE@example.com" })).rejects.toMatchObject({ scope: "email" });
    await expect(service.execute({ ...base, email: "otra-persona@example.com" })).resolves.toBeTruthy();
  });

  it("bloquea al superar el tope global por hora y lo libera cuando pasa la ventana", async () => {
    const repository = new MemoryLeadRepository();
    const startTotal = await repository.countWebLeadsSince(new Date(Date.now() - 60 * 60 * 1000).toISOString());
    const service = new CreateLeadService(repository, { perEmailPerDay: 100, totalPerHour: startTotal + 1 });
    await service.execute({ ...base, email: "global-1@example.com" });
    await expect(service.execute({ ...base, email: "global-2@example.com" })).rejects.toBeInstanceOf(LeadRateLimitError);
    const later = new CreateLeadService(repository, { perEmailPerDay: 100, totalPerHour: startTotal + 1 }, () => new Date(Date.now() + 2 * 60 * 60 * 1000));
    await expect(later.execute({ ...base, email: "global-2@example.com" })).resolves.toBeTruthy();
  });
});

describe("CreateLeadService · conteo no disponible", () => {
  it("guarda el lead aunque falle el conteo de topes", async () => {
    const repository = new MemoryLeadRepository();
    repository.countWebLeadsSince = async () => { throw new Error("sin conexión"); };
    const lead = await new CreateLeadService(repository).execute({ name: "Persona Falla", company: "Empresa Falla", email: "falla@example.com", primaryGoal: "Otro", consentGiven: true });
    expect(lead.id).toBeTruthy();
  });
});
