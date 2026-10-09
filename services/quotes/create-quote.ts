import { z } from "zod";
import { calculateExpansionQuote } from "@/domain/pricing/engine";
import { currentPricingRules } from "@/domain/pricing/rules";
import type { PricingRules } from "@/domain/pricing/types";
import type { OperationsRepository } from "@/repositories/operations-repository";

export const createQuoteSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().trim().min(3).max(160),
  estimatedDays: z.number().positive().max(365),
  complexity: z.enum(["standard", "medium", "high", "research", "advanced_research"]),
  thirdPartyMonthlyCost: z.number().nonnegative().max(1_000_000_000).default(0),
  estimationNotes: z.string().trim().max(3_000).optional()
});

export class CreateQuoteService {
  constructor(private readonly repository: OperationsRepository, private readonly options: { now?: () => Date; id?: () => string; actorUserId?: string; pricingRules?: PricingRules } = {}) {}
  async execute(input: unknown) {
    const command = createQuoteSchema.parse(input);
    const account = await this.repository.findAccount(command.accountId);
    if (!account) throw new Error("Cuenta no encontrada.");
    const pricingRules = this.options.pricingRules ?? currentPricingRules;
    const calculated = calculateExpansionQuote({
      estimatedDays: command.estimatedDays,
      complexity: command.complexity,
      activeSolutionsBeforeAddition: account.activeSolutions,
      estimationNotes: command.estimationNotes,
      thirdPartyCosts: command.thirdPartyMonthlyCost > 0 ? [{
        provider: "Proveedor por confirmar", description: "Costo externo mensual",
        cost: command.thirdPartyMonthlyCost, currency: pricingRules.currency, periodicity: "monthly", paidBy: "rebilled"
      }] : []
    }, pricingRules);
    const id = this.options.id ?? crypto.randomUUID;
    const createdAt = (this.options.now ?? (() => new Date()))().toISOString();
    const quote = { ...calculated, id: id(), accountId: account.id, name: command.name, status: "draft" as const, createdAt };
    await this.repository.createQuote(quote);
    await this.repository.createAudit({ id: id(), actorUserId: this.options.actorUserId ?? "demo-owner", accountId: account.id, entityType: "quote", entityId: quote.id, action: "quote.created", after: { status: quote.status, netImplementation: quote.netImplementation, pricingRuleVersion: quote.pricingRuleVersion }, createdAt });
    return quote;
  }
}
