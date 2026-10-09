import { z } from "zod";
import type { Lead } from "./entities";

type LeadStatus = Lead["status"];

/**
 * Temperatura comercial de un lead: se deriva del score (0-100) para no duplicar datos.
 * El asistente, el formulario web y el equipo la ajustan escribiendo el score.
 */
export const leadTemperatureSchema = z.enum(["hot", "warm", "cold"]);
export type LeadTemperature = z.infer<typeof leadTemperatureSchema>;
/** Cerrados (convertidos o perdidos) se muestran aparte: ya no son pipeline. */
export type LeadTemperatureView = LeadTemperature | "closed";

export const temperatureBands = { hotFrom: 75, warmFrom: 50 } as const;
/** Score que se asigna al clasificar a mano; queda dentro de su banda. */
export const temperatureScores: Record<LeadTemperature, number> = { hot: 85, warm: 60, cold: 30 };
export const closedLeadStatuses: LeadStatus[] = ["converted", "lost"];

export const temperatureLabels: Record<LeadTemperatureView, string> = {
  hot: "Caliente",
  warm: "Tibio",
  cold: "Frío",
  closed: "Cerrado",
};

export function temperatureFromScore(score: number): LeadTemperature {
  if (score >= temperatureBands.hotFrom) return "hot";
  if (score >= temperatureBands.warmFrom) return "warm";
  return "cold";
}

export function leadTemperature(lead: { score: number; status: LeadStatus }): LeadTemperatureView {
  return closedLeadStatuses.includes(lead.status) ? "closed" : temperatureFromScore(lead.score);
}

/** Interés que declara el asistente de WhatsApp al registrar un lead. */
export const assistantInterestScores = { alto: 80, medio: 60, bajo: 35 } as const;
/** Pisos de score por señales fuertes de interés en la conversación. */
export const interestSignalScores = { quoteProposal: 85, meeting: 90 } as const;
