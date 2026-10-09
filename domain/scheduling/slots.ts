/** Reglas de agenda del asistente: horario hábil en la zona horaria del negocio. */
export interface SchedulingRules {
  timeZone: string;
  /** Días hábiles con la convención de `Date#getUTCDay`: 0 domingo … 6 sábado. */
  workdays: number[];
  /** Minutos desde medianoche en hora local. */
  dayStartMinutes: number;
  dayEndMinutes: number;
  meetingMinutes: number;
  /** Anticipación mínima para que el equipo alcance a prepararse. */
  minNoticeMinutes: number;
  horizonDays: number;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

/** Hora (desde medianoche) desde la que se ofrece la segunda opción del día. */
const afternoonStartMinutes = 14 * 60;

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function offsetMinutes(date: Date, timeZone: string) {
  const local = localParts(date, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1_000) * 1_000) / 60_000);
}

/** Convierte una hora local de `timeZone` a un instante UTC, considerando cambios de horario. */
export function zonedTimeToUtc(input: { year: number; month: number; day: number; minutes: number }, timeZone: string) {
  const guess = Date.UTC(input.year, input.month - 1, input.day, 0, input.minutes);
  let instant = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  const corrected = guess - offsetMinutes(new Date(instant), timeZone) * 60_000;
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

function overlaps(start: Date, end: Date, busy: BusyInterval[]) {
  return busy.some((interval) => start < interval.end && end > interval.start);
}

function localDay(date: Date, timeZone: string) {
  const { year, month, day, hour, minute } = localParts(date, timeZone);
  return { year, month, day, minutes: hour * 60 + minute, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** `true` si el inicio cae en horario hábil, alineado a la duración, con anticipación suficiente y dentro del horizonte. */
export function isSlotWithinRules(start: Date, rules: SchedulingRules, now: Date) {
  const local = localDay(start, rules.timeZone);
  if (!rules.workdays.includes(local.weekday)) return false;
  if (local.minutes < rules.dayStartMinutes || local.minutes + rules.meetingMinutes > rules.dayEndMinutes) return false;
  if ((local.minutes - rules.dayStartMinutes) % rules.meetingMinutes !== 0) return false;
  if (start.getTime() < now.getTime() + rules.minNoticeMinutes * 60_000) return false;
  return start.getTime() <= now.getTime() + rules.horizonDays * 24 * 60 * 60_000;
}

export function isSlotFree(start: Date, rules: SchedulingRules, busy: BusyInterval[]) {
  return !overlaps(start, new Date(start.getTime() + rules.meetingMinutes * 60_000), busy);
}

/**
 * Horarios para ofrecer al cliente: por cada día hábil, el primero libre de la mañana y el
 * primero libre de la tarde, hasta `maxSlots`. Pocas opciones variadas funcionan mejor en un chat.
 * Con `allPerDay` devuelve todos los horarios libres de cada día (para elegir en una página).
 */
export function computeAvailableSlots(input: { now: Date; busy: BusyInterval[]; rules: SchedulingRules; maxSlots: number; allPerDay?: boolean }) {
  const { now, busy, rules } = input;
  if (input.allPerDay) return computeAllFreeSlots(input);
  const slots: Date[] = [];
  const today = localDay(now, rules.timeZone);
  for (let offset = 0; offset <= rules.horizonDays && slots.length < input.maxSlots; offset += 1) {
    const calendarDay = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const day = { year: calendarDay.getUTCFullYear(), month: calendarDay.getUTCMonth() + 1, day: calendarDay.getUTCDate() };
    if (!rules.workdays.includes(calendarDay.getUTCDay())) continue;
    let morning: Date | undefined;
    let afternoon: Date | undefined;
    for (let minutes = rules.dayStartMinutes; minutes + rules.meetingMinutes <= rules.dayEndMinutes; minutes += rules.meetingMinutes) {
      const start = zonedTimeToUtc({ ...day, minutes }, rules.timeZone);
      if (!isSlotWithinRules(start, rules, now) || !isSlotFree(start, rules, busy)) continue;
      if (minutes < afternoonStartMinutes) morning ??= start;
      else afternoon ??= start;
      if (afternoon) break;
    }
    for (const slot of [morning, afternoon]) if (slot && slots.length < input.maxSlots) slots.push(slot);
  }
  return slots;
}

function computeAllFreeSlots(input: { now: Date; busy: BusyInterval[]; rules: SchedulingRules; maxSlots: number }) {
  const { now, busy, rules } = input;
  const slots: Date[] = [];
  const today = localDay(now, rules.timeZone);
  for (let offset = 0; offset <= rules.horizonDays && slots.length < input.maxSlots; offset += 1) {
    const calendarDay = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (!rules.workdays.includes(calendarDay.getUTCDay())) continue;
    const day = { year: calendarDay.getUTCFullYear(), month: calendarDay.getUTCMonth() + 1, day: calendarDay.getUTCDate() };
    for (let minutes = rules.dayStartMinutes; minutes + rules.meetingMinutes <= rules.dayEndMinutes && slots.length < input.maxSlots; minutes += rules.meetingMinutes) {
      const start = zonedTimeToUtc({ ...day, minutes }, rules.timeZone);
      if (isSlotWithinRules(start, rules, now) && isSlotFree(start, rules, busy)) slots.push(start);
    }
  }
  return slots;
}

export function formatSlot(date: Date, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

/** Lee "09:00-18:00" como minutos desde medianoche. */
export function parseBusinessHours(value: string) {
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("El horario debe tener formato HH:MM-HH:MM.");
  const [start, end] = [Number(match[1]) * 60 + Number(match[2]), Number(match[3]) * 60 + Number(match[4])];
  if (start >= end || end > 24 * 60) throw new Error("El horario de término debe ser posterior al de inicio.");
  return { dayStartMinutes: start, dayEndMinutes: end };
}

/** Lee "1,2,3,4,5" (lunes a viernes, 0 = domingo). */
export function parseWorkdays(value: string) {
  const days = [...new Set(value.split(",").map((item) => Number(item.trim())))];
  if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Los días hábiles deben ser números de 0 (domingo) a 6 (sábado).");
  return days;
}
