const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
  });
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

assert(process.env.APP_MODE === "supabase", "Este smoke debe ejecutarse con APP_MODE=supabase.");

const landing = await request("/");
const diagnosis = await request("/diagnostico");
const admin = await request("/admin/dashboard");
const suffix = Date.now().toString(36);
const lead = await request("/api/leads", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "Supabase Smoke",
    company: `Empresa Supabase ${suffix}`,
    email: `supabase.${suffix}@example.com`,
    rawNeedDescription: "Automatizar la conciliación diaria entre sistemas operativos.",
    systems: ["ERP", "Pagos"],
    apiKnowledge: "yes",
    peopleInvolved: 4,
    hoursPerMonth: 60,
    monthlyVolume: 700,
    primaryGoal: "Reducir trabajo manual",
    consentGiven: true,
  }),
});

assert(landing.response.status === 200, `Landing respondió ${landing.response.status}.`);
assert(diagnosis.response.status === 200, `Diagnóstico respondió ${diagnosis.response.status}.`);
assert(admin.response.status === 307, `Admin sin sesión respondió ${admin.response.status}; se esperaba 307.`);
assert(admin.response.headers.get("location")?.includes("/login"), "Admin sin sesión no redirigió al login.");
assert(lead.response.status === 201, `Creación de lead respondió ${lead.response.status}: ${JSON.stringify(lead.data)}`);
assert(typeof lead.data?.id === "string", "La creación de lead no devolvió un id persistido.");

console.log(JSON.stringify({
  landing: landing.response.status,
  diagnosis: diagnosis.response.status,
  adminProtection: admin.response.status,
  leadCreation: lead.response.status,
  leadId: lead.data.id,
}, null, 2));
