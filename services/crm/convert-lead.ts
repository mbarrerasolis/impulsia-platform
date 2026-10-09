import { z } from "zod";
import type { OperationsRepository } from "@/repositories/operations-repository";

export const convertLeadSchema = z.object({
  leadId: z.string().min(1),
  industry: z.string().trim().min(2).max(100).default("Por definir")
});

interface ServiceOptions {
  now?: () => Date;
  id?: () => string;
  actorUserId?: string;
}

export class ConvertLeadService {
  constructor(private readonly repository: OperationsRepository, private readonly options: ServiceOptions = {}) {}

  async execute(input: unknown) {
    const command = convertLeadSchema.parse(input);
    const lead = await this.repository.findLead(command.leadId);
    if (!lead) throw new Error("Lead no encontrado.");
    if (lead.convertedAccountId || lead.status === "converted") throw new Error("El lead ya fue convertido.");

    const id = this.options.id ?? crypto.randomUUID;
    const now = (this.options.now ?? (() => new Date()))().toISOString();
    const accountId = id();
    const parts = lead.name.trim().split(/\s+/);
    const firstName = parts.shift() ?? lead.name;
    const lastName = parts.join(" ") || "Contacto";
    const account = {
      id: accountId,
      tradeName: lead.company,
      legalName: lead.company,
      status: "prospect" as const,
      industry: command.industry,
      contactCount: 1,
      activeSolutions: 0,
      mrr: 0
    };
    await this.repository.createAccount(account);
    await this.repository.createContact({
      id: id(), accountId, firstName, lastName, email: lead.email,
      jobTitle: "Contacto principal", roles: ["commercial", "management"]
    });
    await this.repository.saveLead({ ...lead, status: "converted", convertedAccountId: accountId });
    await this.repository.createAudit({
      id: id(), actorUserId: this.options.actorUserId ?? "demo-owner", accountId,
      entityType: "lead", entityId: lead.id, action: "lead.converted",
      before: { status: lead.status }, after: { status: "converted", accountId }, createdAt: now
    });
    return account;
  }
}
