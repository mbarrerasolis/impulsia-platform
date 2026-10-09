/** Horas laborales de una jornada completa al mes (44 h semanales en Chile ≈ 176-190 h); se usa 180. */
export const fullTimeHoursPerMonth = 180;

/**
 * Tiempo que consume un proceso manual. El asistente lo usa en vez de hacer la aritmética de memoria,
 * porque un cálculo mal hecho frente a un cliente le quita credibilidad a toda la conversación.
 */
export function computeTimeImpact(input: { unitsPerDay: number; minutesPerUnit: number; workDaysPerMonth: number }) {
  const minutesPerDay = input.unitsPerDay * input.minutesPerUnit;
  const hoursPerMonth = (minutesPerDay * input.workDaysPerMonth) / 60;
  return {
    minutesPerDay: Math.round(minutesPerDay),
    hoursPerMonth: Math.round(hoursPerMonth),
    /** Fracción de una jornada completa (1 = una persona a tiempo completo). */
    fullTimeEquivalent: Math.round((hoursPerMonth / fullTimeHoursPerMonth) * 100) / 100,
  };
}
