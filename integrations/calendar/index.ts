import "server-only";
import { parseBusinessHours, parseWorkdays } from "@/domain/scheduling/slots";
import { getBrandConfig } from "@/lib/brand";
import { getServerEnv } from "@/lib/env";
import { MeetingScheduler } from "@/services/messaging/meeting-scheduler";
import { GoogleCalendarClient } from "./google-calendar";

/** Devuelve el agendador sólo si ASSISTANT_SCHEDULING_ENABLED=true; si no, el asistente no ofrece reuniones. */
export function createMeetingScheduler(): MeetingScheduler | null {
  const env = getServerEnv();
  if (env.ASSISTANT_SCHEDULING_ENABLED !== "true" || !env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET || !env.GOOGLE_CALENDAR_REFRESH_TOKEN) return null;
  const calendar = new GoogleCalendarClient({
    clientId: env.GOOGLE_CALENDAR_CLIENT_ID,
    clientSecret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
    refreshToken: env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    calendarId: env.GOOGLE_CALENDAR_ID,
  });
  return new MeetingScheduler(calendar, {
    timeZone: env.ASSISTANT_TIME_ZONE,
    workdays: parseWorkdays(env.ASSISTANT_BUSINESS_DAYS),
    ...parseBusinessHours(env.ASSISTANT_BUSINESS_HOURS),
    meetingMinutes: env.ASSISTANT_MEETING_MINUTES,
    minNoticeMinutes: env.ASSISTANT_MEETING_NOTICE_MINUTES,
    horizonDays: env.ASSISTANT_MEETING_HORIZON_DAYS,
  }, getBrandConfig().name);
}
