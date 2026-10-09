import { describe, expect, it, vi } from "vitest";
import type { SchedulingRules } from "@/domain/scheduling/slots";
import { calendarEventId, MeetingScheduler, type CalendarPort } from "./meeting-scheduler";

const rules: SchedulingRules = { timeZone: "America/Santiago", workdays: [1, 2, 3, 4, 5], dayStartMinutes: 540, dayEndMinutes: 1080, meetingMinutes: 30, minNoticeMinutes: 120, horizonDays: 7 };
// Jueves 14 de enero de 2027, 08:00 en Santiago.
const now = () => new Date("2027-01-14T11:00:00.000Z");

function fakeCalendar(busy: { start: Date; end: Date }[] = []) {
  return {
    busy: vi.fn<CalendarPort["busy"]>(async () => busy),
    createEvent: vi.fn<CalendarPort["createEvent"]>(async () => ({ id: "evt_1", meetLink: "https://meet.google.com/abc-defg-hij" })),
  };
}

const request = { attendeeEmail: "ana@demo.cl", attendeeName: "Ana", company: "Demo SpA", topic: "Diagnóstico ERP", idempotencyKey: "conv-1:meeting:1" };

describe("MeetingScheduler", () => {
  it("ofrece horarios según el calendario real", async () => {
    const calendar = fakeCalendar();
    const slots = await new MeetingScheduler(calendar, rules, "ImpulsIA", now).listSlots();
    expect(slots).toHaveLength(4);
    expect(calendar.busy).toHaveBeenCalledTimes(1);
  });

  it("agenda con invitación, Meet e id estable", async () => {
    const calendar = fakeCalendar();
    const start = new Date("2027-01-14T17:00:00.000Z");
    const result = await new MeetingScheduler(calendar, rules, "ImpulsIA", now).book({ ...request, start });

    expect(result).toMatchObject({ ok: true, event: { meetLink: "https://meet.google.com/abc-defg-hij" } });
    const created = calendar.createEvent.mock.calls[0][0];
    expect(created).toMatchObject({ start, end: new Date("2027-01-14T17:30:00.000Z"), attendeeEmail: "ana@demo.cl", eventId: calendarEventId("conv-1:meeting:1") });
    expect(created.summary).toBe("ImpulsIA · Demo SpA: Diagnóstico ERP");
  });

  it("no agenda fuera de las reglas ni sobre un bloque que se ocupó", async () => {
    const outside = fakeCalendar();
    expect(await new MeetingScheduler(outside, rules, "ImpulsIA", now).book({ ...request, start: new Date("2027-01-16T13:00:00.000Z") })).toEqual({ ok: false, reason: "outside_rules" });
    expect(outside.busy).not.toHaveBeenCalled();

    const start = new Date("2027-01-14T17:00:00.000Z");
    const taken = fakeCalendar([{ start, end: new Date("2027-01-14T18:00:00.000Z") }]);
    expect(await new MeetingScheduler(taken, rules, "ImpulsIA", now).book({ ...request, start })).toEqual({ ok: false, reason: "busy" });
    expect(taken.createEvent).not.toHaveBeenCalled();
  });

  it("genera ids de evento válidos para Google y estables", () => {
    const id = calendarEventId("conv-1:meeting:1");
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(calendarEventId("conv-1:meeting:1")).toBe(id);
    expect(calendarEventId("conv-1:meeting:2")).not.toBe(id);
  });
});
