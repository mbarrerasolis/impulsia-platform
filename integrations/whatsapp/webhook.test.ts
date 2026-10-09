import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { describeDeliveryError, extractInboundWhatsAppMessages, extractWhatsAppDeliveryStatuses, mediaFromStoredMessage, verifyWhatsAppSignature } from "./webhook";

describe("WhatsApp webhook security", () => {
  it("accepts only a valid HMAC over the raw body", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const secret = "test-app-secret-with-enough-length";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyWhatsAppSignature(body, signature, secret)).toBe(true);
    expect(verifyWhatsAppSignature(`${body} `, signature, secret)).toBe(false);
    expect(verifyWhatsAppSignature(body, null, secret)).toBe(false);
  });
});

describe("WhatsApp webhook normalization", () => {
  it("extracts inbound text messages from batched entries", () => {
    const messages = extractInboundWhatsAppMessages({
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "12345" },
            contacts: [{ wa_id: "56912345678", profile: { name: "Ana" } }],
            messages: [{ from: "56912345678", id: "wamid.1", timestamp: "1789992000", type: "text", text: { body: "Hola" } }],
          },
        }],
      }],
    });
    expect(messages).toEqual([expect.objectContaining({
      externalId: "wamid.1",
      phoneNumberId: "12345",
      sender: "56912345678",
      profileName: "Ana",
      body: "Hola",
      type: "text",
    })]);
  });

  it("keeps the ad referral of Click-to-WhatsApp messages", () => {
    const [message] = extractInboundWhatsAppMessages({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: {
        messaging_product: "whatsapp",
        metadata: { phone_number_id: "12345" },
        messages: [{
          from: "56912345678", id: "wamid.2", timestamp: "1789992000", type: "text", text: { body: "Hola, vi su anuncio" },
          referral: { source_url: "https://fb.me/abc", source_id: "120210000", source_type: "ad", headline: "Que ningún cliente se quede sin respuesta" },
        }],
      } }] }],
    });
    expect(message.referral).toEqual(expect.objectContaining({ source_id: "120210000", source_type: "ad" }));
  });

  it("extracts voice notes, images and documents with a readable placeholder", () => {
    const payload = (message: Record<string, unknown>) => ({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: {
        messaging_product: "whatsapp",
        metadata: { phone_number_id: "12345" },
        messages: [{ from: "56912345678", id: "wamid.m", timestamp: "1789992000", ...message }],
      } }] }],
    });
    const [voice] = extractInboundWhatsAppMessages(payload({ type: "audio", audio: { id: "111", mime_type: "audio/ogg; codecs=opus", voice: true } }));
    expect(voice.media).toEqual({ kind: "audio", id: "111", mimeType: "audio/ogg; codecs=opus", voice: true });
    expect(voice.body).toBe("[Nota de voz sin transcribir]");
    const [image] = extractInboundWhatsAppMessages(payload({ type: "image", image: { id: "222", mime_type: "image/jpeg", caption: " Mi planilla " } }));
    expect(image.body).toBe("[Imagen] Mi planilla");
    const [document] = extractInboundWhatsAppMessages(payload({ type: "document", document: { id: "333", mime_type: "application/pdf", filename: "factura.pdf" } }));
    expect(document.body).toBe("[Documento: factura.pdf]");
    expect(mediaFromStoredMessage(document.raw)).toEqual({ kind: "document", id: "333", mimeType: "application/pdf", filename: "factura.pdf" });
    expect(mediaFromStoredMessage({ type: "text" })).toBeUndefined();
  });

  it("ignores payloads outside the WhatsApp account object", () => {
    expect(extractInboundWhatsAppMessages({ object: "page", entry: [] })).toEqual([]);
  });

  it("extracts delivery and failure statuses", () => {
    const statuses = extractWhatsAppDeliveryStatuses({
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "12345" },
            statuses: [{
              id: "wamid.outbound-1",
              status: "failed",
              timestamp: "1789992000",
              recipient_id: "56912345678",
              errors: [{ code: 131026 }],
            }],
          },
        }],
      }],
    });
    expect(statuses).toEqual([expect.objectContaining({
      externalId: "wamid.outbound-1",
      status: "failed",
      recipient: "56912345678",
      failed: true,
      error: { code: 131026 },
    })]);
  });
});

describe("describeDeliveryError", () => {
  it("explica en español los códigos conocidos y conserva el detalle de Meta para los demás", () => {
    expect(describeDeliveryError({ deliveryError: { code: 131042, title: "Business eligibility payment issue" } })).toBe("Error 131042: falta un método de pago válido en WhatsApp Manager");
    expect(describeDeliveryError({ deliveryError: { code: 999, title: "Otro", details: "Detalle de Meta" } })).toBe("Error 999: Detalle de Meta");
    expect(describeDeliveryError({ deliveryError: {} })).toBe("Meta no informó el motivo");
    expect(describeDeliveryError({})).toBeUndefined();
  });
});
