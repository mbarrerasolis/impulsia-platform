export const REMINDER_OFFSETS_DAYS = [-5, -1, 0, 3, 7, 15] as const;

export interface ScheduledReminder {
  offsetDays: number;
  scheduledAt: Date;
  kind: "automatic" | "manual_alert";
}

export function schedulePaymentReminders(dueDate: Date): ScheduledReminder[] {
  if (Number.isNaN(dueDate.getTime())) throw new RangeError("Fecha de vencimiento inválida.");
  return REMINDER_OFFSETS_DAYS.map((offsetDays) => {
    const scheduledAt = new Date(dueDate);
    scheduledAt.setUTCDate(scheduledAt.getUTCDate() + offsetDays);
    return {
      offsetDays,
      scheduledAt,
      kind: offsetDays === 15 ? "manual_alert" : "automatic"
    };
  });
}
