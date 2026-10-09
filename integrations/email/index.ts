import { getBrandConfig } from "@/lib/brand";
import { getServerEnv } from "@/lib/env";
import type { EmailProvider } from "./email-provider";
import { MockEmailProvider } from "./mock-email-provider";
import { ResendEmailProvider } from "./resend-email-provider";

/** Los avisos internos (dirigidos al correo de contacto de la marca) van con copia a `notificationCc`. */
export function withTeamCopy(provider: EmailProvider, brand: { contactEmail: string; notificationCc: string[] }): EmailProvider {
  if (!brand.notificationCc.length) return provider;
  const team = brand.contactEmail.toLowerCase();
  return {
    send: (message) => provider.send(message.to.toLowerCase() === team
      ? { ...message, cc: [...new Set([...(message.cc ?? []), ...brand.notificationCc.filter((email) => email.toLowerCase() !== team)])] }
      : message),
  };
}

export function createEmailProvider(): EmailProvider {
  return withTeamCopy(createBaseEmailProvider(), getBrandConfig());
}

function createBaseEmailProvider(): EmailProvider {
  const env = getServerEnv();
  switch (env.EMAIL_PROVIDER) {
    case "mock":
      return new MockEmailProvider();
    case "resend": {
      if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
        throw new Error("EMAIL_PROVIDER=resend requiere RESEND_API_KEY y EMAIL_FROM.");
      }
      return new ResendEmailProvider({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
    }
  }
}
