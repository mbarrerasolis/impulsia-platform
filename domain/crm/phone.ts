/**
 * Teléfonos de clientes en un solo formato (E.164 con "+"), para que el enlace de WhatsApp, la búsqueda
 * y los avisos funcionen igual sin importar cómo se escribió: WhatsApp entrega "56912345678", el equipo
 * escribe "9 1234 5678" o "+56 9 1234 5678". Sin código de país se asume Chile.
 */
export function normalizePhone(text: string | undefined): string | undefined {
  const raw = text?.trim() ?? "";
  if (!raw) return undefined;
  if (/[a-z]/i.test(raw)) return undefined;
  const international = raw.startsWith("+") || raw.startsWith("00");
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  // Chile: celular 9 dígitos (9XXXXXXXX) o fijo 9 dígitos con código de área (2XXXXXXXX, 32XXXXXXX…).
  if (!international && digits.length === 9 && /^[2-9]/.test(digits)) return `+56${digits}`;
  if (digits.startsWith("56")) return digits.length === 11 && /^56[2-9]/.test(digits) ? `+${digits}` : undefined;
  // Otro país: sólo con código explícito (+ o 00) y largo E.164.
  return international && digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0") ? `+${digits}` : undefined;
}

/** "+56912345678" → "+56 9 1234 5678" (Chile); otros países tal cual. */
export function formatPhone(phone: string) {
  const match = /^\+56(9)(\d{4})(\d{4})$/.exec(phone) ?? /^\+56(\d)(\d{4})(\d{4})$/.exec(phone);
  return match ? `+56 ${match[1]} ${match[2]} ${match[3]}` : phone;
}

/**
 * Para teléfonos ya guardados (leads antiguos o de WhatsApp de otro país, que Meta entrega sin "+"):
 * si no es un número chileno, 10 o más dígitos se leen como número internacional.
 */
export function normalizeStoredPhone(phone: string | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return normalizePhone(phone) ?? (digits.length >= 10 ? normalizePhone(`+${digits}`) : undefined);
}

/** Enlace para escribirle por WhatsApp; `undefined` si el número no es válido. */
export function whatsappLink(phone: string | undefined) {
  const normalized = normalizeStoredPhone(phone);
  return normalized ? `https://wa.me/${normalized.slice(1)}` : undefined;
}

export const invalidPhoneMessage = "El teléfono no es válido: usa un celular chileno (9 1234 5678) o el número con código de país (+54…).";
