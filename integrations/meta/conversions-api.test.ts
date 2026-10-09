import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildMetaWebsiteEvent, normalizePhoneForMeta, parseMarketingSignals, sendMetaEvents } from "./conversions-api";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("buildMetaWebsiteEvent", () => {
  it("hashea los datos personales normalizados y conserva el id del evento del píxel", () => {
    const event = buildMetaWebsiteEvent({
      eventId: "lead-1", eventName: "Lead", email: " Camila@Empresa.CL ", phone: "+56 9 1234 5678", firstName: "Camila Rojas",
      signals: { consent: true, fbp: "fb.1.1.2", pageUrl: "https://impulsialabs.cl/diagnostico" },
      clientIp: "200.1.1.1", userAgent: "Mozilla", now: new Date("2026-09-25T15:00:00Z"),
    });
    expect(event).toMatchObject({ event_name: "Lead", event_id: "lead-1", action_source: "website", event_time: 1790348400, event_source_url: "https://impulsialabs.cl/diagnostico" });
    expect(event.user_data).toEqual({
      em: [sha256("camila@empresa.cl")], ph: [sha256("56912345678")], fn: [sha256("camila")],
      client_ip_address: "200.1.1.1", client_user_agent: "Mozilla", fbp: "fb.1.1.2",
    });
    expect(JSON.stringify(event)).not.toContain("camila@empresa.cl");
  });
});

describe("normalizePhoneForMeta", () => {
  it("agrega el código de Chile a celulares de 9 dígitos y descarta números incompletos", () => {
    expect(normalizePhoneForMeta("9 1234 5678")).toBe("56912345678");
    expect(normalizePhoneForMeta("+1 415 555 0100")).toBe("14155550100");
    expect(normalizePhoneForMeta("1234")).toBeUndefined();
  });
});

describe("parseMarketingSignals", () => {
  it("sólo acepta señales con consentimiento explícito", () => {
    expect(parseMarketingSignals(undefined)).toBeUndefined();
    expect(parseMarketingSignals({ consent: false, fbp: "x" })).toBeUndefined();
    expect(parseMarketingSignals({ consent: true, fbp: "fb.1.1.2" })).toEqual({ consent: true, fbp: "fb.1.1.2" });
  });
});

describe("sendMetaEvents", () => {
  it("envía al endpoint del píxel con el código de prueba y falla si Meta rechaza", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const event = buildMetaWebsiteEvent({ eventId: "e1", eventName: "Lead", signals: { consent: true } });
    await sendMetaEvents({ pixelId: "123", accessToken: "token", graphVersion: "v26.0", testEventCode: "TEST1" }, [event], fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v26.0/123/events");
    expect(JSON.parse(String(init.body))).toMatchObject({ test_event_code: "TEST1", data: [{ event_id: "e1" }] });

    const failing = vi.fn(async () => new Response("bad token", { status: 400 }));
    await expect(sendMetaEvents({ pixelId: "123", accessToken: "t", graphVersion: "v26.0" }, [event], failing)).rejects.toThrow("400");
  });
});
