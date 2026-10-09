import { describe, expect, it } from "vitest";
import { getPasswordResetRedirectUrl, getPublicSiteUrl, isTemporarySiteUrl } from "./site-url";

describe("public site URL", () => {
  it("normaliza la raíz pública", () => {
    expect(getPublicSiteUrl("https://impulsialabs.cl/alguna/ruta?x=1").toString()).toBe("https://impulsialabs.cl/");
  });

  it("distingue hosts temporales de dominios oficiales", () => {
    expect(isTemporarySiteUrl("https://impulsia-self.vercel.app")).toBe(true);
    expect(isTemporarySiteUrl("http://localhost:3000")).toBe(true);
    expect(isTemporarySiteUrl("https://impulsialabs.cl")).toBe(false);
  });

  it("construye el retorno seguro para recuperación de contraseña", () => {
    expect(getPasswordResetRedirectUrl("https://impulsialabs.cl/otra-ruta").toString()).toBe(
      "https://impulsialabs.cl/auth/set-password",
    );
  });
});
