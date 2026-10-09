create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check(status in ('draft','approved','rejected')),
  estimated_days numeric not null check(estimated_days > 0),
  complexity text not null,
  complexity_factor numeric not null,
  day_rate_snapshot bigint not null check(day_rate_snapshot > 0),
  gross_implementation_price bigint not null check(gross_implementation_price >= 0),
  expansion_discount_percent numeric not null check(expansion_discount_percent between 0 and 100),
  active_solutions_after_addition integer not null check(active_solutions_after_addition >= 1),
  net_implementation_price bigint not null check(net_implementation_price >= 0),
  gross_maintenance_increment bigint not null check(gross_maintenance_increment >= 0),
  maintenance_discount_percent numeric not null check(maintenance_discount_percent between 0 and 100),
  net_maintenance_increment bigint not null check(net_maintenance_increment >= 0),
  third_party_costs jsonb not null default '[]',
  estimation_notes text,
  pricing_rule_version text not null,
  pricing_snapshot jsonb not null,
  created_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_account_status_idx on public.quotes(account_id,status);
create trigger touch_quotes before update on public.quotes for each row execute function public.touch_updated_at();
alter table public.quotes enable row level security;
create policy quotes_internal_read on public.quotes for select to authenticated
  using(public.current_role() in ('owner_admin','sales'));
create policy quotes_client_read on public.quotes for select to authenticated
  using(account_id=public.current_account_id() and status='approved' and public.current_role()='client_admin');

create or replace function public.audit_quote_created()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  insert into public.audit_log(actor_user_id,account_id,entity_type,entity_id,action,after_data)
  values(new.created_by,new.account_id,'quote',new.id::text,'quote.created',
    jsonb_build_object('status',new.status,'netImplementation',new.net_implementation_price,'pricingRuleVersion',new.pricing_rule_version));
  return new;
end;
$$;

revoke all on function public.audit_quote_created() from public,anon,authenticated;
create trigger audit_quote_after_insert after insert on public.quotes
for each row execute function public.audit_quote_created();

alter table public.client_solutions
  add column quote_id uuid unique references public.quotes(id);

comment on table public.quotes is 'Cotizaciones versionadas. Sus montos se copian a client_solutions al aprobar y no se recalculan.';
