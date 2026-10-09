import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clientFor(key) {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function rows(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
}

assert(process.env.APP_MODE === "supabase", "Este smoke debe ejecutarse con APP_MODE=supabase.");

const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const service = clientFor(secretKey);
const anonymous = clientFor(publishableKey);
const suffix = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
const password = `Rls-${crypto.randomUUID()}-Aa1!`;
const createdUserIds = [];
const anonymousLeadEmail = `rls-anon-${suffix}@example.com`;
const auditEntityId = `rls-smoke-${suffix}`;

const internalRoles = ["owner_admin", "sales", "technical", "finance", "support"];
const clientRoles = ["client_admin", "client_billing", "client_technical", "client_viewer"];

async function createAuthenticatedClient(role, accountId = null) {
  const email = `rls-${role}-${suffix}@example.com`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    throw new Error(`No fue posible crear usuario ${role}: ${created.error?.message ?? "sin usuario"}`);
  }
  createdUserIds.push(created.data.user.id);

  const profile = await service.from("profiles").insert({
    id: created.data.user.id,
    account_id: accountId,
    role,
    display_name: `RLS ${role}`,
  });
  if (profile.error) throw new Error(`No fue posible crear perfil ${role}: ${profile.error.message}`);

  const client = clientFor(publishableKey);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    throw new Error(`No fue posible iniciar sesión como ${role}: ${signedIn.error?.message ?? "sin sesión"}`);
  }
  return client;
}

try {
  const accounts = await rows(await service.from("accounts").select("id").order("id"), "fixture accounts");
  assert(accounts.length >= 2, "El seed debe contener al menos dos cuentas.");
  const accountId = accounts[0].id;

  const auditFixture = await service.from("audit_log").insert({
    account_id: accountId,
    entity_type: "rls_smoke",
    entity_id: auditEntityId,
    action: "rls_smoke.created",
  });
  if (auditFixture.error) throw new Error(`No fue posible crear fixture de auditoría: ${auditFixture.error.message}`);

  const anonAccounts = await rows(await anonymous.from("accounts").select("id"), "anon accounts");
  assert(anonAccounts.length === 0, "Anon no debe leer cuentas.");

  const validLead = await anonymous.from("leads").insert({
    source: "web",
    name: "RLS Anonymous",
    company: "RLS Smoke",
    email: anonymousLeadEmail,
    raw_need_description: "Validación ejecutable de la política pública de inserción.",
    systems: ["ERP"],
    api_knowledge: "unknown",
    primary_goal: "Validar seguridad",
    consent_given: true,
  });
  assert(!validLead.error, `Anon debe insertar un lead web consentido: ${validLead.error?.message}`);

  const invalidLead = await anonymous.from("leads").insert({
    source: "outbound",
    name: "RLS Invalid",
    company: "RLS Smoke",
    email: `rls-invalid-${suffix}@example.com`,
    raw_need_description: "Este registro debe ser rechazado por la política pública.",
    systems: [],
    api_knowledge: "unknown",
    primary_goal: "Validar rechazo",
    consent_given: false,
  });
  assert(invalidLead.error, "Anon no debe insertar leads sin consentimiento y origen web.");

  const internalClients = new Map();
  for (const role of internalRoles) internalClients.set(role, await createAuthenticatedClient(role));

  const pricingRule = await service.from("pricing_rules").select("id,rounding_multiple").limit(1).single();
  if (pricingRule.error) throw new Error(`No fue posible leer pricing fixture: ${pricingRule.error.message}`);

  for (const [role, client] of internalClients) {
    const visibleAccounts = await rows(await client.from("accounts").select("id"), `${role} accounts`);
    const visibleLeads = await rows(await client.from("leads").select("id"), `${role} leads`);
    const visibleAudit = await rows(
      await client.from("audit_log").select("id").eq("entity_id", auditEntityId),
      `${role} audit`,
    );
    assert(visibleAccounts.length >= 2, `${role} debe leer todas las cuentas.`);
    assert(visibleLeads.length >= 1, `${role} debe leer leads.`);
    assert(
      visibleAudit.length === (role === "owner_admin" || role === "finance" ? 1 : 0),
      `${role} no respeta la política de auditoría esperada.`,
    );

    const pricingWrite = await rows(
      await client
        .from("pricing_rules")
        .update({ rounding_multiple: pricingRule.data.rounding_multiple })
        .eq("id", pricingRule.data.id)
        .select("id"),
      `${role} pricing write`,
    );
    assert(
      pricingWrite.length === (role === "owner_admin" ? 1 : 0),
      `${role} no respeta la política de escritura de pricing.`,
    );
  }

  const roleClients = new Map();
  for (const role of clientRoles) roleClients.set(role, await createAuthenticatedClient(role, accountId));

  for (const [role, client] of roleClients) {
    const visibleAccounts = await rows(await client.from("accounts").select("id"), `${role} accounts`);
    const contacts = await rows(await client.from("contacts").select("account_id"), `${role} contacts`);
    const baseSolutions = await rows(await client.from("client_solutions").select("account_id"), `${role} solutions`);
    const portalSolutions = await rows(await client.rpc("list_portal_solutions"), `${role} portal solutions`);
    const subscriptions = await rows(await client.from("subscriptions").select("account_id"), `${role} subscriptions`);
    const billing = await rows(await client.from("billing_periods").select("id"), `${role} billing`);
    const payments = await rows(await client.from("payments").select("id"), `${role} payments`);
    const integrations = await rows(await client.from("integrations").select("account_id"), `${role} integrations`);

    assert(visibleAccounts.length === 1 && visibleAccounts[0].id === accountId, `${role} debe ver sólo su cuenta.`);
    assert(contacts.every((row) => row.account_id === accountId), `${role} recibió contactos de otra cuenta.`);
    assert(baseSolutions.every((row) => row.account_id === accountId), `${role} recibió soluciones de otra cuenta.`);
    assert(portalSolutions.every((row) => row.account_id === accountId), `${role} recibió portal de otra cuenta.`);
    assert(subscriptions.every((row) => row.account_id === accountId), `${role} recibió suscripciones de otra cuenta.`);
    assert(integrations.every((row) => row.account_id === accountId), `${role} recibió integraciones de otra cuenta.`);

    const expectsContacts = role === "client_admin" || role === "client_technical";
    const expectsBaseSolutions = role === "client_admin";
    const expectsPortalSolutions = role === "client_admin" || role === "client_technical" || role === "client_viewer";
    const expectsFinancials = role === "client_admin" || role === "client_billing";
    const expectsIntegrations = role === "client_admin" || role === "client_technical";

    assert((contacts.length > 0) === expectsContacts, `${role} no respeta visibilidad de contactos.`);
    assert((baseSolutions.length > 0) === expectsBaseSolutions, `${role} no respeta visibilidad de soluciones financieras.`);
    assert((portalSolutions.length > 0) === expectsPortalSolutions, `${role} no respeta el read model del portal.`);
    assert((subscriptions.length > 0) === expectsFinancials, `${role} no respeta visibilidad de suscripciones.`);
    assert((billing.length > 0) === expectsFinancials, `${role} no respeta visibilidad de cobranza.`);
    assert((payments.length > 0) === expectsFinancials, `${role} no respeta visibilidad de pagos.`);
    assert((integrations.length > 0) === expectsIntegrations, `${role} no respeta visibilidad de integraciones.`);

    const accountWrite = await rows(
      await client.from("accounts").update({ trade_name: "No autorizado" }).eq("id", accountId).select("id"),
      `${role} account write`,
    );
    assert(accountWrite.length === 0, `${role} no debe modificar la cuenta.`);
  }

  console.log(JSON.stringify({
    anonymous: ["account isolation", "valid lead insert", "invalid lead rejection"],
    internalRoles,
    clientRoles,
    assertions: "passed",
  }, null, 2));
} finally {
  await service.from("audit_log").delete().eq("entity_id", auditEntityId);
  await service.from("leads").delete().eq("email", anonymousLeadEmail);
  for (const userId of createdUserIds.reverse()) await service.auth.admin.deleteUser(userId);
}
