import type { Lead } from "@/domain/crm/entities";
import { leadOrigin } from "@/domain/marketing/lead-channel";

/** Etiqueta de procedencia del lead (Instagram · Pagado, WhatsApp, Google · Orgánico…). */
export function LeadOriginTag({ lead }: { lead: Pick<Lead, "source" | "attribution"> }) {
  const origin = leadOrigin(lead);
  return <span className={`origin-tag origin-${origin.channel}`} title={origin.campaign ? `Campaña: ${origin.campaign}` : undefined}>{origin.label}</span>;
}
