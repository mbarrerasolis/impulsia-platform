import { describe, expect, it } from "vitest";
import { defaultFollowUpRules, evaluateFollowUp, type FollowUpCandidate } from "./follow-up";

const rules = { ...defaultFollowUpRules, delayMinutes: 4 };

const now = new Date("2026-09-25T18:00:00Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

const base: FollowUpCandidate = {
  status: "bot_qualifying",
  lastInboundAt: minutesAgo(6),
  lastMessage: { direction: "outbound", sentAt: minutesAgo(4) },
  meetings: 0,
  followUps: { count: 0 },
};

describe("evaluateFollowUp", () => {
  it("hace seguimiento cuando el asistente respondió y el cliente lleva 4 minutos sin contestar", () => {
    expect(evaluateFollowUp(base, rules, now)).toEqual({ due: true });
  });

  it("espera los 4 minutos desde la última respuesta del asistente", () => {
    expect(evaluateFollowUp({ ...base, lastMessage: { direction: "outbound", sentAt: minutesAgo(2) } }, rules, now)).toEqual({ due: false, reason: "too_soon" });
  });

  it("no interviene si una persona tomó la conversación o ya hay reunión", () => {
    expect(evaluateFollowUp({ ...base, status: "waiting_human" }, rules, now)).toEqual({ due: false, reason: "status" });
    expect(evaluateFollowUp({ ...base, meetings: 1 }, rules, now)).toEqual({ due: false, reason: "meeting_booked" });
  });

  it("no hace seguimiento si lo último lo escribió el cliente", () => {
    expect(evaluateFollowUp({ ...base, lastMessage: { direction: "inbound", sentAt: minutesAgo(5) } }, rules, now)).toEqual({ due: false, reason: "awaiting_reply" });
  });

  it("uno por pausa y como máximo dos por conversación", () => {
    expect(evaluateFollowUp({ ...base, followUps: { count: 1, lastForInboundAt: base.lastInboundAt! } }, rules, now)).toEqual({ due: false, reason: "already_followed_up" });
    expect(evaluateFollowUp({ ...base, followUps: { count: 1, lastForInboundAt: minutesAgo(300) } }, rules, now)).toEqual({ due: true });
    expect(evaluateFollowUp({ ...base, followUps: { count: 2, lastForInboundAt: minutesAgo(300) } }, rules, now)).toEqual({ due: false, reason: "max_reached" });
  });

  it("respeta la ventana de 24 h de WhatsApp", () => {
    expect(evaluateFollowUp({ ...base, lastInboundAt: minutesAgo(23 * 60 + 5) }, rules, now)).toEqual({ due: false, reason: "window_closed" });
  });
});
