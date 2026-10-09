import { describe, expect, it, vi } from "vitest";
import type { SchedulingRules } from "@/domain/scheduling/slots";
import { MemoryLeadRepository } from "@/repositories/memory/memory-lead-repository";
import { MeetingScheduler, type CalendarPort } from "@/services/messaging/meeting-scheduler";
import { BookWebMeetingService } from "./book-web-meeting";
import { CreateLeadService, LeadRateLimitError } from "./create-lead";

const rules: SchedulingRules = { timeZone: "America/Santiago", workdays: [1, 2, 3, 4, 5], dayStartMinutes: 540, dayEndMinutes: 1080, meetingMinutes: 30, minNoticeMinutes: 120, horizonDays: 7 };
// Jueves 14 de enero de 2027, 08:00 en Santiago; 14:00 en Santiago = 17:00 UTC.
const now = () => new Date("2027-01-14T11:00:00.000Z");
const start = "2027-01-14T17:00:00.000Z";

function setup(busy: { start: Date; end: Date }[] = []) {
  const calendar = {
    busy: vi.fn<CalendarPort["busy"]>(async () => busy),
    createEvent: vi.fn<CalendarPort["createEvent"]>(async () => ({ id: "evt_1", meetLink: "https://meet.google.com/abc-defg-hij" })),
  };
  const leads = new MemoryLeadRepository();
  const service = new BookWebMeetingService(leads, new MeetingScheduler(calendar, rules, "ImpulsIA", now));
  return { calendar, leads, service };
}

const input = {
  name: "Ana Pérez",
  company: "Burger Demo",
  email: "Ana@BurgerDemo.cl",
  phone: "+56 9 1234 5678",
  topic: "Pedidos por WhatsApp en hora punta",
  start,
  consentGiven: true,
  attribution: { utmSource: "email", utmMedium: "outbound", utmCampaign: "comida-piloto", utmContent: "A-017" },
};

describe("BookWebMeetingService", () => {
  it("agenda la reunión y deja el lead caliente con su procedencia", async () => {
    const { calendar, leads, service } = setup();
    const result = await service.execute(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meetLink).toBe("https://meet.google.com/abc-defg-hij");
    expect(calendar.createEvent).toHaveBeenCalledWith(expect.objectContaining({ attendeeEmail: "ana@burgerdemo.cl" }));
    expect(calendar.createEvent.mock.calls[0][0].description).toContain("desde la página de agenda del sitio");
    const saved = await leads.find(result.lead.id);
    expect(saved?.score).toBe(90);
    expect(saved?.phone).toBe("+56 9 1234 5678");
    expect(saved?.attribution?.utmCampaign).toBe("comida-piloto");
    expect(saved?.rawNeedDescription).toContain("Pedidos por WhatsApp en hora punta");
  });

  it("no crea el lead si el horario ya se ocupó", async () => {
    const { calendar, leads, service } = setup([{ start: new Date(start), end: new Date("2027-01-14T17:30:00.000Z") }]);
    const before = (await leads.list()).length;
    const result = await service.execute(input);
    expect(result).toEqual({ ok: false, reason: "busy" });
    expect(calendar.createEvent).not.toHaveBeenCalled();
    expect(await leads.list()).toHaveLength(before);
  });

  it("rechaza horarios fuera de las reglas", async () => {
    const { service } = setup();
    const result = await service.execute({ ...input, start: "2027-01-16T14:00:00.000Z" });
    expect(result).toEqual({ ok: false, reason: "outside_rules" });
  });

  it("exige teléfono y consentimiento", async () => {
    const { service } = setup();
    await expect(service.execute({ ...input, phone: "" })).rejects.toThrow();
    await expect(service.execute({ ...input, consentGiven: false })).rejects.toThrow();
  });

  it("aplica los topes del formulario antes de reservar el horario", async () => {
    const calendar = { busy: vi.fn<CalendarPort["busy"]>(async () => []), createEvent: vi.fn<CalendarPort["createEvent"]>() };
    const leads = new MemoryLeadRepository();
    const createLead = new CreateLeadService(leads, { perEmailPerDay: 0, totalPerHour: 20 });
    const service = new BookWebMeetingService(leads, new MeetingScheduler(calendar, rules, "ImpulsIA", now), createLead);
    await expect(service.execute(input)).rejects.toBeInstanceOf(LeadRateLimitError);
    expect(calendar.createEvent).not.toHaveBeenCalled();
  });
});
