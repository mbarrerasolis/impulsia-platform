import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, normalizeStoredPhone, whatsappLink } from "./phone";

describe("teléfonos de clientes", () => {
  it("deja los números chilenos como +56 escritos como sea", () => {
    for (const input of ["9 1234 5678", "912345678", "+56 9 1234 5678", "56912345678", "+56-9-1234-5678", "(+56) 9 1234 5678", "0056912345678"]) {
      expect(normalizePhone(input), input).toBe("+56912345678");
    }
    expect(normalizePhone("2 2345 6789")).toBe("+56223456789");
    expect(normalizePhone("32 234 5678")).toBe("+56322345678");
  });

  it("acepta otros países sólo con código explícito", () => {
    expect(normalizePhone("+54 9 11 2345 6789")).toBe("+5491123456789");
    expect(normalizePhone("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizePhone("5491123456789")).toBeUndefined();
  });

  it("rechaza lo que no es un teléfono", () => {
    for (const input of ["1234 5678", "12345", "mi cel es 9 1234 5678", "+56 1 2345 6789", "569123456789", "091234567"]) {
      expect(normalizePhone(input), input).toBeUndefined();
    }
    expect(normalizePhone("")).toBeUndefined();
    expect(normalizePhone(undefined)).toBeUndefined();
  });

  it("lee números guardados de WhatsApp de otro país (sin +) y arma el enlace", () => {
    expect(normalizeStoredPhone("5491123456789")).toBe("+5491123456789");
    expect(normalizeStoredPhone("56912345678")).toBe("+56912345678");
    expect(whatsappLink("9 1234 5678")).toBe("https://wa.me/56912345678");
    expect(whatsappLink("5491123456789")).toBe("https://wa.me/5491123456789");
    expect(whatsappLink("1234")).toBeUndefined();
  });

  it("muestra los chilenos con espacios", () => {
    expect(formatPhone("+56912345678")).toBe("+56 9 1234 5678");
    expect(formatPhone("+56223456789")).toBe("+56 2 2345 6789");
    expect(formatPhone("+5491123456789")).toBe("+5491123456789");
  });
});
