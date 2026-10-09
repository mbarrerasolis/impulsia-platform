import type { LeadAttribution } from "@/domain/marketing/attribution";

export const leadSources =["web", "instagram", "whatsapp", "email", "referral", "outbound", "other"] as const;
export type LeadSource = (typeof leadSources)[number];

export interface Lead {
  id: string;
  source: LeadSource;
  name: string;
  company: string;
  email: string;
  phone?: string;
  rawNeedDescription: string;
  systems: string[];
  apiKnowledge: "yes" | "no" | "unknown";
  peopleInvolved?: number;
  hoursPerMonth?: number;
  monthlyVolume?: number;
  primaryGoal: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  score: number;
  consentGiven: boolean;
  convertedAccountId?: string;
  /** Origen de marketing (UTM, anuncio o sitio de referencia), si se conoce. */
  attribution?: LeadAttribution;
  createdAt: string;
}

export interface AccountSummary {
  id: string;
  tradeName: string;
  legalName: string;
  status: "lead" | "prospect" | "active" | "paused" | "churned";
  industry: string;
  contactCount: number;
  activeSolutions: number;
  mrr: number;
}

export interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle: string;
  roles: Array<"commercial" | "billing" | "technical" | "administrative" | "management">;
  isActive?: boolean;
  isPrimaryBilling?: boolean;
}
