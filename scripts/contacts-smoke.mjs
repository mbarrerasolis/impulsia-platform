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
const ownerEmail = `contacts-owner-${suffix}@example.com`;
const ownerPassword = `Contacts-${crypto.randomUUID()}-Aa1!`;
const leadEmail = `contacts-lead-${suffix}@example.com`;

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
  const profile = await service.from("profiles").insert({ id: ownerId, role: "owner_admin", display_name: "Owner Contacts Smoke" });
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
    body: JSON.stringify({ name: "Contacts Smoke", company: `Empresa Contactos ${suffix}`, email: leadEmail, primaryGoal: "Ahorrar tiempo operativo", consentGiven: true }),
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

  const create = await request(`/api/admin/accounts/${accountId}/contacts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Josefina", lastName: "Reyes", email: `josefina-${suffix}@example.com`, jobTitle: "Finanzas",
      roles: ["billing"], isPrimaryBilling: true,
    }),
  });
  assert(create.response.status === 201, `Creación de contacto respondió ${create.response.status}: ${JSON.stringify(create.data)}`);
  const contactId = create.data.id;

  const contactCheck = await service.from("contacts").select("is_primary_billing,is_active,contact_roles(role)").eq("id", contactId).single();
  assert(!contactCheck.error, `No fue posible leer el contacto creado: ${contactCheck.error?.message}`);
  assert(contactCheck.data.is_primary_billing === true, "El contacto creado debía quedar como facturación principal.");
  assert(contactCheck.data.contact_roles.some((row) => row.role === "billing"), "El contacto creado debía tener el rol billing.");

  const update = await request(`/api/admin/contacts/${contactId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accountId, roles: ["billing", "administrative"], isPrimaryBilling: true, isActive: false }),
  });
  assert(update.response.status === 200, `Actualización de contacto respondió ${update.response.status}: ${JSON.stringify(update.data)}`);

  const afterUpdate = await service.from("contacts").select("is_active,contact_roles(role)").eq("id", contactId).single();
  assert(afterUpdate.data.is_active === false, "isActive=false no se guardó.");
  assert(afterUpdate.data.contact_roles.map((row) => row.role).sort().join(",") === "administrative,billing", "Los roles no quedaron como se esperaba tras la edición.");

  console.log(JSON.stringify({
    login: login.response.status,
    leadConversion: convert.response.status,
    contactCreate: create.response.status,
    contactUpdate: update.response.status,
    accountId,
    contactId,
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
