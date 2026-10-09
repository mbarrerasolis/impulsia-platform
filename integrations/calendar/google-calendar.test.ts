import { describe, expect, it, vi } from "vitest";
import { GoogleCalendarClient } from "./google-calendar";

const credentials = { clientId: "cid", clientSecret: "secret", refreshToken: "refresh", calendarId: "contacto@impulsialabs.cl" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("GoogleCalendarClient", () => {
  it("renueva el token una vez y lee los bloques ocupados", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ calendars: { "contacto@impulsialabs.cl": { busy: [{ start: "2027-01-14T13:00:00Z", end: "2027-01-14T14:00:00Z" }] } } }))
      .mockResolvedValueOnce(json({ calendars: { "contacto@impulsialabs.cl": { busy: [] } } }));
    const client = new GoogleCalendarClient(credentials, fetchImpl);

    const busy = await client.busy(new Date("2027-01-14T00:00:00Z"), new Date("2027-01-15T00:00:00Z"));
    await client.busy(new Date("2027-01-15T00:00:00Z"), new Date("2027-01-16T00:00:00Z"));

    expect(busy).toEqual([{ start: new Date("2027-01-14T13:00:00Z"), end: new Date("2027-01-14T14:00:00Z") }]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[1][0])).toBe("https://www.googleapis.com/calendar/v3/freeBusy");
    expect((fetchImpl.mock.calls[1][1]!.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("no asume disponibilidad si Google no puede leer el calendario", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ calendars: { "contacto@impulsialabs.cl": { errors: [{ reason: "notFound" }] } } }));
    await expect(new GoogleCalendarClient(credentials, fetchImpl).busy(new Date(), new Date())).rejects.toThrow();
  });

  it("crea el evento con Meet, invitación e id fijo", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ id: "impulsiaabc", hangoutLink: "https://meet.google.com/x" }));
    const event = await new GoogleCalendarClient(credentials, fetchImpl).createEvent({
      eventId: "impulsiaabc", start: new Date("2027-01-14T17:00:00Z"), end: new Date("2027-01-14T17:30:00Z"),
      summary: "Reunión", description: "Detalle", attendeeEmail: "ana@demo.cl", requestId: "req-1",
    });

    expect(event).toEqual({ id: "impulsiaabc", htmlLink: undefined, meetLink: "https://meet.google.com/x" });
    const [url, init] = fetchImpl.mock.calls[1];
    expect(String(url)).toBe("https://www.googleapis.com/calendar/v3/calendars/contacto%40impulsialabs.cl/events?conferenceDataVersion=1&sendUpdates=all");
    const body = JSON.parse(String(init!.body));
    expect(body).toMatchObject({ id: "impulsiaabc", attendees: [{ email: "ana@demo.cl" }], conferenceData: { createRequest: { requestId: "req-1" } } });
  });

  it("falla si Google rechaza la credencial", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ error: "invalid_grant" }, 400));
    await expect(new GoogleCalendarClient(credentials, fetchImpl).busy(new Date(), new Date())).rejects.toThrow("Google OAuth respondió 400.");
  });
});
