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
const ownerEmail = `manualpay-owner-${suffix}@example.com`;
const ownerPassword = `Manualpay-${crypto.randomUUID()}-Aa1!`;
const leadEmail = `manualpay-lead-${suffix}@example.com`;

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
  const created = await service.auth.admin.createUser({ email: ownerEmail, password: ownerPassword, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`No fue posible crear el owner: ${created.error?.message ?? "sin usuario"}`);
  ownerId = created.data.user.id;
  const profile = await service.from("profiles").insert({ id: ownerId, role: "owner_admin", display_name: "Owner Manual Payment Smoke" });
  if (profile.error) throw new Error(`No fue posible crear el perfil del owner: ${profile.error.message}`);

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
  });
  assert(login.response.status === 200, `Login respondió ${login.response.status}: ${JSON.stringify(login.data)}`);

  const lead = await request("/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Manual Payment Smoke", company: `Empresa Pago Manual ${suffix}`, email: leadEmail, primaryGoal: "Ahorrar tiempo operativo", consentGiven: true }),
  });
  assert(lead.response.status === 201, `Creación de lead respondió ${lead.response.status}: ${JSON.stringify(lead.data)}`);
  leadId = lead.data.id;

  const convert = await request(`/api/admin/leads/${leadId}/convert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ industry: "Servicios" }),
  });
  assert(convert.response.status === 201, `Conversión respondió ${convert.response.status}: ${JSON.stringify(convert.data)}`);
  accountId = convert.data.account.id;

  const quote = await request("/api/admin/quotes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accountId, name: "Automatización con pago manual", estimatedDays: 5, complexity: "standard", thirdPartyMonthlyCost: 0 }),
  });
  assert(quote.response.status === 201, `Cotización respondió ${quote.response.status}: ${JSON.stringify(quote.data)}`);

  const approve = await request(`/api/admin/quotes/${quote.data.quote.id}/approve`, { method: "POST" });
  assert(approve.response.status === 200, `Aprobación respondió ${approve.response.status}: ${JSON.stringify(approve.data)}`);
  const billingPeriodId = approve.data.result.billingPeriod.id;

  const manual = await request(`/api/admin/billing/${billingPeriodId}/manual-payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reference: "BancoEstado transferencia #99001" }),
  });
  assert(manual.response.status === 200, `Pago manual respondió ${manual.response.status}: ${JSON.stringify(manual.data)}`);

  const period = await service.from("billing_periods").select("status,amount_paid,amount_due").eq("id", billingPeriodId).single();
  assert(!period.error, `No fue posible leer el período: ${period.error?.message}`);
  assert(period.data.status === "paid", `El período debía quedar 'paid', quedó '${period.data.status}'.`);
  assert(period.data.amount_paid === period.data.amount_due, "El monto pagado no coincide con el monto adeudado.");

  const payment = await service.from("payments").select("provider,status,raw_provider_payload").eq("billing_period_id", billingPeriodId).single();
  assert(!payment.error, `No fue posible leer el pago: ${payment.error?.message}`);
  assert(payment.data.provider === "manual" && payment.data.status === "approved", "El registro de pago manual no quedó como se esperaba.");
  assert(payment.data.raw_provider_payload.reference === "BancoEstado transferencia #99001", "La evidencia no se guardó.");

  // Segundo intento sobre un período ya pagado debe rechazarse.
  const repeat = await request(`/api/admin/billing/${billingPeriodId}/manual-payment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reference: "Intento duplicado" }),
  });
  assert(repeat.response.status === 409, `Un segundo pago manual sobre un período pagado debía responder 409, respondió ${repeat.response.status}.`);

  console.log(JSON.stringify({
    login: login.response.status,
    quoteApproval: approve.response.status,
    manualPayment: manual.response.status,
    periodStatus: period.data.status,
    duplicateRejected: repeat.response.status,
    accountId,
    billingPeriodId,
  }, null, 2));
} finally {
  const cleanupErrors = [];
  if (accountId) {
    const subscriptions = await service.from("subscriptions").select("id").eq("account_id", accountId);
    const subscriptionIds = (subscriptions.data ?? []).map((row) => row.id);
    if (subscriptionIds.length > 0) {
      const items = await service.from("subscription_items").delete().in("subscription_id", subscriptionIds);
      if (items.error) cleanupErrors.push(`subscription_items: ${items.error.message}`);

      const periods = await service.from("billing_periods").select("id").in("subscription_id", subscriptionIds);
      const periodIds = (periods.data ?? []).map((row) => row.id);
      if (periodIds.length > 0) {
        const payments = await service.from("payments").select("id").in("billing_period_id", periodIds);
        const paymentIds = (payments.data ?? []).map((row) => row.id);
        if (paymentIds.length > 0) {
          const events = await service.from("payment_events").delete().in("payment_id", paymentIds);
          if (events.error) cleanupErrors.push(`payment_events: ${events.error.message}`);
        }
      }
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
