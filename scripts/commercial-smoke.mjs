import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(process.env.APP_MODE === "supabase", "Este smoke debe ejecutarse con APP_MODE=supabase.");

const service = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const suffix = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
const ownerEmail = `commercial-owner-${suffix}@example.com`;
const ownerPassword = `Comm-${crypto.randomUUID()}-Aa1!`;
const leadEmail = `commercial-lead-${suffix}@example.com`;

let ownerId = null;
let leadId = null;
let accountId = null;
let cookie = "";

async function request(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", ...options, headers });
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (setCookies.length > 0) cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
  const text = await response.text();
  const data = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })();
  return { response, data };
}

try {
  const unauthenticatedDashboard = await request("/admin/dashboard");
  assert(
    unauthenticatedDashboard.response.status === 307,
    `El dashboard sin sesión respondió ${unauthenticatedDashboard.response.status}; se esperaba 307.`,
  );

  const created = await service.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true });
  if (created.error || !created.data.user) {
    throw new Error(`No fue posible crear el owner: ${created.error?.message ?? "sin usuario"}`);
  }
  ownerId = created.data.user.id;
  const profile = await service.from("profiles").insert({ id: ownerId, role: "owner_admin", display_name: "Owner Smoke" });
  if (profile.error) throw new Error(`No fue posible crear el perfil del owner: ${profile.error.message}`);

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });
  assert(login.response.status === 200, `Login respondió ${login.response.status}: ${JSON.stringify(login.data)}`);
  assert(login.data?.redirectTo === "/admin/dashboard", "El login no redirigió al dashboard interno.");
  assert(cookie.length > 0, "El login no estableció una sesión.");

  const dashboard = await request("/admin/dashboard");
  assert(dashboard.response.status === 200, `El dashboard autenticado respondió ${dashboard.response.status}.`);

  const lead = await request("/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Comercial Smoke",
      company: `Empresa Comercial ${suffix}`,
      email: leadEmail,
      rawNeedDescription: "Automatizar el ciclo de facturación mensual entre ERP y banco.",
      systems: ["ERP", "Banco"],
      apiKnowledge: "yes",
      peopleInvolved: 3,
      hoursPerMonth: 40,
      monthlyVolume: 500,
      primaryGoal: "Reducir trabajo manual",
      consentGiven: true,
    }),
  });
  assert(lead.response.status === 201, `Creación de lead respondió ${lead.response.status}: ${JSON.stringify(lead.data)}`);
  leadId = lead.data.id;

  const convert = await request(`/api/admin/leads/${leadId}/convert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ industry: "Retail" }),
  });
  assert(convert.response.status === 201, `Conversión de lead respondió ${convert.response.status}: ${JSON.stringify(convert.data)}`);
  accountId = convert.data.account.id;

  const quote = await request("/api/admin/quotes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accountId,
      name: "Automatización de facturación",
      estimatedDays: 12,
      complexity: "medium",
      thirdPartyMonthlyCost: 0,
    }),
  });
  assert(quote.response.status === 201, `Creación de cotización respondió ${quote.response.status}: ${JSON.stringify(quote.data)}`);
  const quoteId = quote.data.quote.id;
  assert(typeof quote.data.quote.netImplementation === "number", "La cotización no devolvió un monto neto.");

  const approve = await request(`/api/admin/quotes/${quoteId}/approve`, { method: "POST" });
  assert(approve.response.status === 200, `Aprobación de cotización respondió ${approve.response.status}: ${JSON.stringify(approve.data)}`);
  assert(typeof approve.data.result?.billingPeriod?.id === "string", "La aprobación no generó un período de cobranza.");

  console.log(JSON.stringify({
    dashboardProtection: unauthenticatedDashboard.response.status,
    login: login.response.status,
    leadCreation: lead.response.status,
    leadConversion: convert.response.status,
    quoteCreation: quote.response.status,
    quoteApproval: approve.response.status,
    accountId,
    quoteId,
    billingPeriodId: approve.data.result.billingPeriod.id,
  }, null, 2));
} finally {
  const cleanupErrors = [];
  if (accountId) {
    const subscriptions = await service.from("subscriptions").select("id").eq("account_id", accountId);
    const subscriptionIds = (subscriptions.data ?? []).map((row) => row.id);
    if (subscriptionIds.length > 0) {
      const items = await service.from("subscription_items").delete().in("subscription_id", subscriptionIds);
      if (items.error) cleanupErrors.push(`subscription_items: ${items.error.message}`);
    }
    const audit = await service.from("audit_log").delete().eq("account_id", accountId);
    if (audit.error) cleanupErrors.push(`audit_log: ${audit.error.message}`);
  }
  if (leadId) {
    const lead = await service.from("leads").delete().eq("id", leadId);
    if (lead.error) cleanupErrors.push(`leads: ${lead.error.message}`);
  }
  if (accountId) {
    const account = await service.from("accounts").delete().eq("id", accountId);
    if (account.error) cleanupErrors.push(`accounts: ${account.error.message}`);
  }
  if (ownerId) {
    const user = await service.auth.admin.deleteUser(ownerId);
    if (user.error) cleanupErrors.push(`auth user: ${user.error.message}`);
  }
  if (cleanupErrors.length > 0) {
    console.error("Limpieza incompleta:", cleanupErrors.join("; "));
    process.exitCode = 1;
  }
}
