const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = (() => {
    try { return JSON.parse(text); } catch { return text; }
  })();
  if (!response.ok) throw new Error(`${path} respondió ${response.status}: ${text}`);
  return { status: response.status, data };
}

const suffix = Date.now().toString(36);
const landing = await request("/");
const portal = await request("/portal");
const lead = await request("/api/leads", {
  name: "Smoke Workflow",
  company: `Empresa Smoke ${suffix}`,
  email: `smoke.${suffix}@example.com`,
  rawNeedDescription: "Automatizar la conciliación diaria entre el ERP y la plataforma de pagos.",
  systems: ["ERP", "Pagos"],
  apiKnowledge: "yes",
  peopleInvolved: 5,
  hoursPerMonth: 80,
  monthlyVolume: 900,
  primaryGoal: "Reducir trabajo manual",
  consentGiven: true,
});
const conversion = await request(`/api/admin/leads/${lead.data.id}/convert`, { industry: "Servicios" });
const quote = await request("/api/admin/quotes", {
  accountId: conversion.data.account.id,
  name: "Automatización conciliación",
  estimatedDays: 8,
  complexity: "standard",
  thirdPartyMonthlyCost: 12_000,
});
const approval = await request(`/api/admin/quotes/${quote.data.quote.id}/approve`, {});
const periodId = approval.data.result.billingPeriod.id;
const paymentLink = await request(`/api/admin/billing/${periodId}/payment-link`, {});
const payment = await request(`/api/dev/payments/${periodId}/approve`, {});
const duplicate = await request(`/api/dev/payments/${periodId}/approve`, {});
const quoteDetail = await request(`/admin/quotes/${quote.data.quote.id}`);
const accounts = await request("/admin/accounts");
const solutions = await request("/admin/solutions");
const billing = await request("/admin/billing");

if (duplicate.data.idempotent !== true) throw new Error("El webhook duplicado no fue idempotente.");
if (!billing.data.includes("paid")) throw new Error("Cobranza no refleja el período pagado.");

console.log(JSON.stringify({
  pages: {
    landing: landing.status,
    portal: portal.status,
    quoteDetail: quoteDetail.status,
    accounts: accounts.status,
    solutions: solutions.status,
    billing: billing.status,
  },
  lead: lead.data,
  conversion: conversion.data,
  quote: {
    id: quote.data.quote.id,
    netImplementation: quote.data.quote.netImplementation,
  },
  approval: approval.data,
  paymentLink: paymentLink.data,
  payment: payment.data,
  duplicate: duplicate.data,
}, null, 2));
