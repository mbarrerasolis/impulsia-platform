import { storeOrderGoals } from "@/domain/storefront/order-lead";
import type { Lead } from "@/domain/crm/entities";
import { leadTemperature, type LeadTemperatureView } from "@/domain/crm/lead-temperature";
import { matchesLeadFilters, type LeadFilters } from "@/domain/crm/lead-filters";
import type { LeadListRequest, LeadRepository } from "../lead-repository";
import { demoStore } from "./demo-store";
import { createPageResult, normalizePageRequest } from "@/lib/pagination";

export class MemoryLeadRepository implements LeadRepository {
  async create(input: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
    const lead: Lead = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    demoStore.leads.unshift(lead);
    return lead;
  }

  async list() {
    return [...demoStore.leads];
  }
  async listPage(input: LeadListRequest = {}) {
    const { page, pageSize, from, to } = normalizePageRequest(input);
    const rows = demoStore.leads
      .filter((lead) => (!input.temperature || leadTemperature(lead) === input.temperature) && matchesLeadFilters(lead, input))
      .sort((a, b) => (input.sort === "recent" ? 0 : b.score - a.score) || b.createdAt.localeCompare(a.createdAt));
    return createPageResult(rows.slice(from, to + 1), rows.length, page, pageSize);
  }
  async countByTemperature(filters: LeadFilters = {}) {
    const counts: Record<LeadTemperatureView, number> = { hot: 0, warm: 0, cold: 0, closed: 0 };
    for (const lead of demoStore.leads) if (matchesLeadFilters(lead, filters)) counts[leadTemperature(lead)] += 1;
    return counts;
  }
  async updateScore(id: string, score: number) {
    const lead = demoStore.leads.find((item) => item.id === id);
    if (lead) lead.score = score;
  }
  async find(id: string) { return demoStore.leads.find((lead)=>lead.id===id); }
  async countWebLeadsSince(since: string, email?: string) {
    return demoStore.leads.filter((lead) => lead.source === "web" && lead.createdAt >= since && (!email || lead.email.toLowerCase() === email)).length;
  }
  async countStoreOrdersSince(since: string) {
    return demoStore.leads.filter((lead) => (storeOrderGoals as readonly string[]).includes(lead.primaryGoal) && lead.createdAt >= since).length;
  }
}
