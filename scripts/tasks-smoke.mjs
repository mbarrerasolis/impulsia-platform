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
const ownerEmail = `tasks-owner-${suffix}@example.com`;
const ownerPassword = `Tasks-${crypto.randomUUID()}-Aa1!`;
const leadEmail = `tasks-lead-${suffix}@example.com`;

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
  const profile = await service.from("profiles").insert({ id: ownerId, role: "owner_admin", display_name: "Owner Tasks Smoke" });
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
    body: JSON.stringify({ name: "Tasks Smoke", company: `Empresa Tareas ${suffix}`, email: leadEmail, primaryGoal: "Ahorrar tiempo operativo", consentGiven: true }),
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
    body: JSON.stringify({ accountId, name: "Automatización con tareas", estimatedDays: 6, complexity: "standard", thirdPartyMonthlyCost: 0 }),
  });
  assert(quote.response.status === 201, `Cotización respondió ${quote.response.status}: ${JSON.stringify(quote.data)}`);

  const approve = await request(`/api/admin/quotes/${quote.data.quote.id}/approve`, { method: "POST" });
  assert(approve.response.status === 200, `Aprobación respondió ${approve.response.status}: ${JSON.stringify(approve.data)}`);

  const solutionRow = await service.from("client_solutions").select("id").eq("account_id", accountId).single();
  assert(!solutionRow.error, `No fue posible leer la solución aprobada: ${solutionRow.error?.message}`);
  const clientSolutionId = solutionRow.data.id;

  const create = await request(`/api/admin/solutions/${clientSolutionId}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Configurar webhook de facturación", assignee: ownerId, estimateHours: 4, dueDate: "2026-10-01" }),
  });
  assert(create.response.status === 201, `Creación de tarea respondió ${create.response.status}: ${JSON.stringify(create.data)}`);
  const taskId = create.data.id;

  const taskCheck = await service.from("implementation_tasks").select("status,assignee,estimate_hours").eq("id", taskId).single();
  assert(!taskCheck.error, `No fue posible leer la tarea creada: ${taskCheck.error?.message}`);
  assert(taskCheck.data.status === "pending", "La tarea nueva debía quedar en estado pending.");
  assert(taskCheck.data.assignee === ownerId, "El responsable no se guardó.");
  assert(Number(taskCheck.data.estimate_hours) === 4, "Las horas estimadas no se guardaron.");

  const update = await request(`/api/admin/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "done", assignee: ownerId, actualHours: 5.5, dueDate: "2026-10-01" }),
  });
  assert(update.response.status === 200, `Actualización de tarea respondió ${update.response.status}: ${JSON.stringify(update.data)}`);

  const afterUpdate = await service.from("implementation_tasks").select("status,actual_hours").eq("id", taskId).single();
  assert(afterUpdate.data.status === "done", "La tarea debía quedar 'done' tras la edición.");
  assert(Number(afterUpdate.data.actual_hours) === 5.5, "Las horas reales no se guardaron.");

  console.log(JSON.stringify({
    login: login.response.status,
    quoteApproval: approve.response.status,
    taskCreate: create.response.status,
    taskUpdate: update.response.status,
    accountId,
    clientSolutionId,
    taskId,
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
