import { describe, expect, it } from "vitest";
import { computeTimeImpact } from "./impact";

describe("computeTimeImpact", () => {
  it("calcula horas al mes y jornadas equivalentes", () => {
    // 60 exámenes × 2 min = 120 min al día × 22 días = 44 horas al mes.
    expect(computeTimeImpact({ unitsPerDay: 60, minutesPerUnit: 2, workDaysPerMonth: 22 })).toEqual({ minutesPerDay: 120, hoursPerMonth: 44, fullTimeEquivalent: 0.24 });
    expect(computeTimeImpact({ unitsPerDay: 80, minutesPerUnit: 5, workDaysPerMonth: 22 }).hoursPerMonth).toBe(147);
  });
});
