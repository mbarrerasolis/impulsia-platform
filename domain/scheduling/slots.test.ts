import { describe, expect, it } from "vitest";
import { computeAvailableSlots, formatSlot, isSlotWithinRules, parseBusinessHours, parseWorkdays, zonedTimeToUtc, type SchedulingRules } from "./slots";

const rules: SchedulingRules = {
  timeZone: "America/Santiago",
  workdays: [1, 2, 3, 4, 5],
  dayStartMinutes: 9 * 60,
  dayEndMinutes: 18 * 60,
  meetingMinutes: 30,
  minNoticeMinutes: 120,
  horizonDays: 7,
};

describe("zonedTimeToUtc", () => {
  it("respeta el horario de verano y de invierno de Chile", () => {
    // Enero: UTC-3. Julio: UTC-4.
    expect(zonedTimeToUtc({ year: 2027, month: 1, day: 15, minutes: 10 * 60 }, "America/Santiago").toISOString()).toBe("2027-01-15T13:00:00.000Z");
    expect(zonedTimeToUtc({ year: 2027, month: 7, day: 15, minutes: 10 * 60 }, "America/Santiago").toISOString()).toBe("2027-07-15T14:00:00.000Z");
  });
});

describe("computeAvailableSlots", () => {
  // Jueves 14 de enero de 2027, 08:00 en Santiago (11:00 UTC).
  const now = new Date("2027-01-14T11:00:00.000Z");

  it("ofrece mañana y tarde por día hábil, salta el fin de semana y respeta la anticipación", () => {
    const slots = computeAvailableSlots({ now, busy: [], rules, maxSlots: 4 });
    expect(slots.map((slot) => slot.toISOString())).toEqual([
      "2027-01-14T13:00:00.000Z", // jueves 10:00 (09:00 y 09:30 quedan dentro de las 2 h de aviso)
      "2027-01-14T17:00:00.000Z", // jueves 14:00
      "2027-01-15T12:00:00.000Z", // viernes 09:00
      "2027-01-15T17:00:00.000Z", // viernes 14:00
    ]);
    const monday = computeAvailableSlots({ now, busy: [], rules, maxSlots: 6 })[4];
    expect(monday.toISOString()).toBe("2027-01-18T12:00:00.000Z");
  });

  it("evita los bloques ocupados del calendario", () => {
    const busy = [{ start: new Date("2027-01-14T13:00:00.000Z"), end: new Date("2027-01-14T15:00:00.000Z") }];
    expect(computeAvailableSlots({ now, busy, rules, maxSlots: 1 })[0].toISOString()).toBe("2027-01-14T15:00:00.000Z");
  });

  it("valida un inicio propuesto con las mismas reglas", () => {
    expect(isSlotWithinRules(new Date("2027-01-14T17:00:00.000Z"), rules, now)).toBe(true);
    expect(isSlotWithinRules(new Date("2027-01-14T17:10:00.000Z"), rules, now)).toBe(false); // no alineado
    expect(isSlotWithinRules(new Date("2027-01-16T13:00:00.000Z"), rules, now)).toBe(false); // sábado
    expect(isSlotWithinRules(new Date("2027-01-14T21:00:00.000Z"), rules, now)).toBe(false); // 18:00, fuera de horario
    expect(isSlotWithinRules(new Date("2027-01-14T11:30:00.000Z"), rules, now)).toBe(false); // sin anticipación
    expect(isSlotWithinRules(new Date("2027-01-25T13:00:00.000Z"), rules, now)).toBe(false); // fuera del horizonte
  });
});

describe("configuración", () => {
  it("lee horario, días hábiles y formatea en español", () => {
    expect(parseBusinessHours("09:00-18:30")).toEqual({ dayStartMinutes: 540, dayEndMinutes: 1110 });
    expect(() => parseBusinessHours("18:00-09:00")).toThrow();
    expect(parseWorkdays("1, 2,3,4,5")).toEqual([1, 2, 3, 4, 5]);
    expect(() => parseWorkdays("1,8")).toThrow();
    expect(formatSlot(new Date("2027-01-14T17:00:00.000Z"), "es-CL", "America/Santiago")).toMatch(/jueves.*14.*enero.*14:00/);
  });
});

describe("computeAvailableSlots con allPerDay", () => {
  it("devuelve todos los horarios libres del día en orden, sin los ocupados", () => {
    const rules = { timeZone: "America/Santiago", workdays: [1, 2, 3, 4, 5], dayStartMinutes: 540, dayEndMinutes: 1080, meetingMinutes: 30, minNoticeMinutes: 120, horizonDays: 7 };
    // Jueves 14 de enero de 2027, 08:00 en Santiago (UTC-3): el primer horario con 2 h de aviso es 10:00.
    const now = new Date("2027-01-14T11:00:00.000Z");
    const busy = [{ start: new Date("2027-01-14T13:30:00.000Z"), end: new Date("2027-01-14T14:00:00.000Z") }];
    const slots = computeAvailableSlots({ now, busy, rules, maxSlots: 5, allPerDay: true });
    expect(slots.map((slot) => slot.toISOString())).toEqual([
      "2027-01-14T13:00:00.000Z",
      "2027-01-14T14:00:00.000Z",
      "2027-01-14T14:30:00.000Z",
      "2027-01-14T15:00:00.000Z",
      "2027-01-14T15:30:00.000Z",
    ]);
  });
});
