import type { AccountSummary, Contact, Lead } from "@/domain/crm/entities";
import type { AuditRecord, BillingPeriodRecord, ClientSolutionRecord, PaymentEventRecord, PaymentRecord, QuoteRecord, ReminderRecord, SubscriptionItemRecord, SubscriptionRecord } from "@/domain/operations/entities";

export interface DemoStore {
  leads: Lead[];
  accounts: AccountSummary[];
  contacts: Contact[];
  quotes: QuoteRecord[];
  solutions: ClientSolutionRecord[];
  subscriptions: SubscriptionRecord[];
  subscriptionItems: SubscriptionItemRecord[];
  billingPeriods: BillingPeriodRecord[];
  payments: PaymentRecord[];
  paymentEvents: PaymentEventRecord[];
  reminders: ReminderRecord[];
  auditLog: AuditRecord[];
}

const initialAccounts: AccountSummary[] = [
  { id: "a1", tradeName: "Andina Logística", legalName: "Andina Logística SpA", status: "active", industry: "Logística", contactCount: 3, activeSolutions: 3, mrr: 264_000 },
  { id: "a2", tradeName: "NorteSalud", legalName: "Servicios NorteSalud Ltda.", status: "active", industry: "Salud", contactCount: 2, activeSolutions: 2, mrr: 185_000 },
  { id: "a3", tradeName: "Estudio Cobalto", legalName: "Cobalto Arquitectura SpA", status: "prospect", industry: "Arquitectura", contactCount: 1, activeSolutions: 0, mrr: 0 },
  { id: "a4", tradeName: "Mercado Litoral", legalName: "Comercial Litoral SpA", status: "active", industry: "Retail", contactCount: 2, activeSolutions: 5, mrr: 492_000 },
  { id: "a5", tradeName: "Agrícola Roble", legalName: "Agrícola Roble Sur Ltda.", status: "paused", industry: "Agricultura", contactCount: 2, activeSolutions: 1, mrr: 65_000 }
];

const initialContacts: Contact[] = [
  { id: "c1", accountId: "a1", firstName: "Camila", lastName: "Rojas", email: "camila@andina.example", jobTitle: "Gerenta de Operaciones", roles: ["management", "commercial"] },
  { id: "c2", accountId: "a1", firstName: "Diego", lastName: "Silva", email: "diego@andina.example", jobTitle: "Jefe de TI", roles: ["technical"] },
  { id: "c3", accountId: "a1", firstName: "Elena", lastName: "Mora", email: "elena@andina.example", jobTitle: "Administración", roles: ["billing", "administrative"] }
];

const initialLeads: Lead[] = Array.from({ length: 10 }, (_, index) => {
  const number = index + 1;
  const names = ["Valentina Pérez", "Matías Soto", "Paula Díaz", "Rodrigo Vega", "Fernanda Núñez"];
  const companies = ["Clínica Horizonte", "Distribuidora Sur", "Taller Nativo", "Fresco Market", "Servicios Cordillera"];
  return {
    id: `l${number}`,
    source: (["web", "referral", "instagram", "outbound", "email"] as const)[index % 5],
    name: names[index % names.length],
    company: `${companies[index % companies.length]}${index >= 5 ? ` ${number}` : ""}`,
    email: `contacto${number}@example.com`,
    rawNeedDescription: "Necesita automatizar la validación y el traspaso diario de información entre sistemas.",
    systems: ["ERP", "Email"],
    apiKnowledge: "unknown",
    peopleInvolved: 3,
    hoursPerMonth: 45,
    monthlyVolume: 300,
    primaryGoal: "Ahorrar tiempo operativo",
    status: index % 3 === 0 ? "qualified" : index % 3 === 1 ? "contacted" : "new",
    score: 55 + index * 4,
    consentGiven: true,
    createdAt: new Date(Date.UTC(2026, 8, 1 + index)).toISOString()
  };
});

const globalForDemo = globalThis as unknown as { impulsiaDemoStore?: DemoStore };
export const demoStore = globalForDemo.impulsiaDemoStore ?? {
  leads: initialLeads,
  accounts: initialAccounts,
  contacts: initialContacts,
  quotes: [],
  solutions: [],
  subscriptions: [],
  subscriptionItems: [],
  billingPeriods: [],
  payments: [],
  paymentEvents: [],
  reminders: [],
  auditLog: []
};
// Un solo almacén por proceso: las rutas API y las páginas se empaquetan por separado y deben ver los mismos datos demo.
globalForDemo.impulsiaDemoStore = demoStore;
demoStore.quotes ??= [];
demoStore.solutions ??= [];
demoStore.subscriptions ??= [];
demoStore.subscriptionItems ??= [];
demoStore.billingPeriods ??= [];
demoStore.payments ??= [];
demoStore.paymentEvents ??= [];
demoStore.reminders ??= [];
demoStore.auditLog ??= [];

export function createEmptyDemoStore(): DemoStore {
  return { leads: [], accounts: [], contacts: [], quotes: [], solutions: [], subscriptions: [], subscriptionItems: [], billingPeriods: [], payments: [], paymentEvents: [], reminders: [], auditLog: [] };
}
