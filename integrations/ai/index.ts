import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AssistantLimits } from "@/domain/messaging/assistant-guards";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { getServerEnv } from "@/lib/env";
import salesKnowledge from "@/config/sales-knowledge.json";
import { parseSalesKnowledge } from "@/domain/messaging/sales-knowledge";
import { createMeetingScheduler } from "@/integrations/calendar";
import type { MeetingScheduler } from "@/services/messaging/meeting-scheduler";
import { SalesAssistant, type ConversationAssistant } from "@/services/messaging/sales-assistant";
import { StoreAssistant } from "@/services/messaging/store-assistant";
import { getStorefront } from "@/lib/storefront";
import { storefrontWithInventory } from "@/services/store/inventory";
import { createSaleNotifier } from "@/services/store/sale-notifications";
import { getSaleRepository } from "@/repositories";

export interface SalesAssistantRuntime {
  /** Ediciones con tienda usan el asistente de productos; las de servicios, el de venta consultiva. */
  assistant: ConversationAssistant;
  model: string;
  limits: AssistantLimits;
  /** Agenda en Google Calendar; null si está apagada. */
  scheduler: MeetingScheduler | null;
  appUrl: string;
}

/** Devuelve el asistente sólo si AI_PROVIDER=anthropic; en cualquier otro caso el sistema usa el guion determinista. */
export function createSalesAssistantRuntime(): SalesAssistantRuntime | null {
  const env = getServerEnv();
  if (env.AI_PROVIDER !== "anthropic" || !env.ANTHROPIC_API_KEY) return null;
  const brand = getBrandConfig();
  const edition = getEditionConfig();
  // Timeout corto y un solo reintento: el webhook de Meta no puede esperar indefinidamente.
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25_000 });
  const limits = {
    dailyBudgetUsd: env.AI_DAILY_BUDGET_USD,
    maxRepliesPerConversationDay: env.AI_MAX_REPLIES_PER_CONVERSATION_DAY,
    maxMessagesPerSenderMinute: env.AI_MAX_MESSAGES_PER_SENDER_MINUTE,
    maxMessagesPerSenderDay: env.AI_MAX_MESSAGES_PER_SENDER_DAY,
  };
  const storefront = getStorefront();
  if (storefront) {
    return {
      model: env.AI_MODEL,
      scheduler: null,
      appUrl: env.NEXT_PUBLIC_APP_URL,
      limits,
      assistant: new StoreAssistant({ create: (params) => client.messages.create(params) }, {
        model: env.AI_MODEL,
        brandName: brand.name,
        contactEmail: brand.contactEmail,
        locale: edition.locale,
        currency: edition.pricing.currency,
        siteUrl: env.NEXT_PUBLIC_APP_URL,
        storefront,
        loadStorefront: () => storefrontWithInventory(storefront),
        // Pago en la página: se activa cuando Flow cobre pedidos (fase B, pendiente de la cuenta del cliente).
        sales: { repository: getSaleRepository(), gatewayEnabled: false, notify: createSaleNotifier() },
      }),
    };
  }
  const scheduler = createMeetingScheduler();
  return {
    model: env.AI_MODEL,
    scheduler,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    limits,
    assistant: new SalesAssistant(
      { create: (params) => client.messages.create(params) },
      {
        model: env.AI_MODEL,
        brandName: brand.name,
        brandDescription: brand.description,
        contactEmail: brand.contactEmail,
        locale: edition.locale,
        catalog: edition.catalog,
        pricing: edition.pricing,
        knowledge: parseSalesKnowledge(salesKnowledge),
        ...(scheduler ? { scheduling: { timeZone: scheduler.rules.timeZone, meetingMinutes: scheduler.rules.meetingMinutes } } : {}),
      },
    ),
  };
}
