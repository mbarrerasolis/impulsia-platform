import type { BusyInterval } from "@/domain/scheduling/slots";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface GoogleCalendarCredentials {
  clientId: string;
  clientSecret: string;
  /** Token de actualización OAuth del buzón dueño del calendario (scope `calendar.events` + `calendar.freebusy`). */
  refreshToken: string;
  calendarId: string;
}

export interface CreatedCalendarEvent {
  id: string;
  htmlLink?: string;
  meetLink?: string;
}

/**
 * Cliente mínimo de Google Calendar: sólo consulta disponibilidad (free/busy) y crea eventos.
 * No lista, edita ni borra eventos existentes.
 */
export class GoogleCalendarClient {
  private token?: { value: string; expiresAt: number };

  constructor(private readonly credentials: GoogleCalendarCredentials, private readonly fetchImpl: typeof fetch = fetch) {}

  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const response = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.credentials.refreshToken,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Google OAuth respondió ${response.status}.`);
    const data = await response.json() as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1_000 };
    return data.access_token;
  }

  private async request<T>(path: string, body: unknown) {
    const response = await this.fetchImpl(`${CALENDAR_API}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Google Calendar respondió ${response.status}.`);
    return await response.json() as T;
  }

  async busy(timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
    const { calendarId } = this.credentials;
    const data = await this.request<{ calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> }>("/freeBusy", {
      timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: calendarId }],
    });
    const calendar = data.calendars[calendarId];
    // Si Google no puede leer el calendario, no se asume que está libre.
    if (!calendar || calendar.errors?.length) throw new Error("Google Calendar no entregó la disponibilidad del calendario.");
    return (calendar.busy ?? []).map((interval) => ({ start: new Date(interval.start), end: new Date(interval.end) }));
  }

  /** `eventId` fijo (base32hex) hace que Google rechace con 409 un segundo intento del mismo evento. */
  async createEvent(input: { eventId: string; start: Date; end: Date; summary: string; description: string; attendeeEmail: string; requestId: string }): Promise<CreatedCalendarEvent> {
    const calendarId = encodeURIComponent(this.credentials.calendarId);
    const event = await this.request<{ id: string; htmlLink?: string; hangoutLink?: string }>(`/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`, {
      id: input.eventId,
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start.toISOString() },
      end: { dateTime: input.end.toISOString() },
      attendees: [{ email: input.attendeeEmail }],
      conferenceData: { createRequest: { requestId: input.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
      guestsCanModify: false,
      guestsCanInviteOthers: false,
    });
    return { id: event.id, htmlLink: event.htmlLink, meetLink: event.hangoutLink };
  }
}
