import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory=import.meta.dirname;
const rls=readFileSync(join(migrationsDirectory,"202609140002_rls.sql"),"utf8");
const quotes=readFileSync(join(migrationsDirectory,"202609140003_quotes.sql"),"utf8");
const workflows=readFileSync(join(migrationsDirectory,"202609140004_transactional_workflows.sql"),"utf8");
const editionCurrency=readFileSync(join(migrationsDirectory,"202609210002_subscription_currency_from_pricing_snapshot.sql"),"utf8");
const pagedReadModels=readFileSync(join(migrationsDirectory,"202609220001_paged_admin_read_models.sql"),"utf8");

describe("guardas estáticas de RLS",()=>{
  it.each(["accounts","profiles","contacts","client_solutions","subscriptions","subscription_items","billing_periods","payments","integrations","credential_metadata","audit_log"])("habilita RLS en %s",table=>{
    expect(rls).toContain(`alter table public.${table} enable row level security;`);
  });
  it("aísla las lecturas financieras del portal por account_id",()=>{
    expect(rls).toMatch(/billing_client_read[\s\S]*s\.account_id=public\.current_account_id\(\)/);
    expect(rls).toMatch(/payment_client_read[\s\S]*s\.account_id=public\.current_account_id\(\)/);
  });
  it("no concede escritura de pagos al cliente",()=>{
    expect(rls).not.toMatch(/payment_client_(insert|update|write)/);
    expect(rls).toContain("Only trusted server-side service-role handlers may write them");
  });
  it("protege cotizaciones aprobadas por cuenta",()=>{
    expect(quotes).toContain("alter table public.quotes enable row level security;");
    expect(quotes).toContain("account_id=public.current_account_id()");
    expect(quotes).toContain("quotes_internal_read on public.quotes for select");
    expect(quotes).not.toMatch(/quotes_internal_(all|write)|on public\.quotes for (all|insert|update|delete) to authenticated/);
    expect(quotes).toContain("create trigger audit_quote_after_insert");
  });
  it("no entrega columnas financieras de soluciones a roles técnicos o de consulta",()=>{
    expect(rls).toContain("solutions_client_read on public.client_solutions for select to authenticated using(account_id=public.current_account_id() and public.current_role()='client_admin')");
    expect(workflows).toContain("function public.list_portal_solutions()");
    expect(workflows).toContain("returns table(id uuid,account_id uuid,name text,status public.solution_status,estimated_days numeric)");
    expect(workflows).not.toMatch(/returns table\([^)]*(price|amount|cost)/);
  });
  it("limita suscripciones e items a administración y facturación del cliente",()=>{
    expect(rls).toMatch(/subscriptions_client_read[\s\S]*?'client_admin','client_billing'\)\)/);
    expect(rls).toMatch(/subscription_items_client_read[\s\S]*?'client_admin','client_billing'\)\)/);
  });
  it("propaga la moneda del snapshot sin permitir mezclar monedas en una suscripción",()=>{
    expect(editionCurrency).toContain("pricing_snapshot->>'currency'");
    expect(editionCurrency).toContain("subscription_currency_mismatch");
    expect(editionCurrency).toContain("after insert on public.subscription_items");
  });
  it("pagina los read models autenticados y evita acceso anónimo",()=>{
    expect(pagedReadModels).toContain("list_conversation_summaries_page");
    expect(pagedReadModels).toContain("messages_conversation_sent_desc_idx");
    expect(pagedReadModels).toContain("get_dashboard_metrics");
    expect(pagedReadModels).toMatch(/limit least\(greatest\(p_limit,1\),100\)/);
    expect(pagedReadModels).toMatch(/revoke execute[\s\S]*from public,anon/);
    expect(pagedReadModels).toContain("security invoker");
  });
});

const inventory=readFileSync(join(migrationsDirectory,"202610040001_store_inventory.sql"),"utf8");

describe("inventario de la tienda",()=>{
  it("habilita RLS y sólo deja leer al equipo interno",()=>{
    expect(inventory).toContain("alter table public.product_variants enable row level security;");
    expect(inventory).toContain("alter table public.inventory_movements enable row level security;");
    expect(inventory).not.toMatch(/to anon/);
  });
  it("no deja escribir el stock ni los movimientos directamente",()=>{
    expect(inventory).toContain("revoke insert, update, delete on public.product_variants from anon, authenticated;");
    expect(inventory).toContain("revoke insert, update, delete on public.inventory_movements from anon, authenticated;");
    expect(inventory).not.toMatch(/grant (insert|update) \([^)]*\bstock\b[^)]*\)/);
    expect(inventory).toMatch(/record_inventory_movement[\s\S]*security definer[\s\S]*public\.is_internal\(\)[\s\S]*for update/);
    expect(inventory).toContain("revoke all on function public.record_inventory_movement(uuid, integer, text, text) from public, anon;");
  });
});

const storeSales=readFileSync(join(migrationsDirectory,"202610080001_store_sales.sql"),"utf8");

describe("ventas de la tienda",()=>{
  it("habilita RLS en todas las tablas y sólo deja leer al equipo interno",()=>{
    for(const table of ["store_sale_counters","store_sales","store_quote_versions","store_payments","store_sale_events"]) expect(storeSales).toContain(`alter table public.${table} enable row level security;`);
    expect(storeSales).not.toMatch(/to anon/);
    expect(storeSales).not.toMatch(/for (insert|update|delete|all)/);
  });
  it("nadie escribe con su sesión y el correlativo sólo lo pide el servidor",()=>{
    expect(storeSales).toContain("revoke insert, update, delete on public.store_sales, public.store_quote_versions, public.store_payments, public.store_sale_events from anon, authenticated;");
    expect(storeSales).toMatch(/next_store_sale_number[\s\S]*security definer[\s\S]*service_role/);
    expect(storeSales).toContain("revoke all on function public.next_store_sale_number(text, integer) from public, anon, authenticated;");
  });
});
