create extension if not exists pgcrypto;

create type public.app_role as enum ('owner_admin','sales','technical','finance','support','client_admin','client_billing','client_technical','client_viewer');
create type public.account_status as enum ('lead','prospect','active','paused','churned');
create type public.solution_status as enum ('proposed','approved','development','testing','production','paused','cancelled');
create type public.payment_status as enum ('pending','approved','rejected','refunded','cancelled');
create type public.billing_status as enum ('upcoming','pending','paid','overdue','void');

create table public.accounts (
  id uuid primary key default gen_random_uuid(), legal_name text not null, trade_name text not null,
  tax_id text, industry text, status public.account_status not null default 'lead', website text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, account_id uuid references public.accounts(id) on delete cascade,
  role public.app_role not null, display_name text not null, two_factor_required boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint client_role_requires_account check ((role::text like 'client_%' and account_id is not null) or (role::text not like 'client_%' and account_id is null))
);
create table public.contacts (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  first_name text not null, last_name text not null, email text not null, phone text, job_title text, is_active boolean not null default true,
  is_primary_billing boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(account_id,email)
);
create table public.contact_roles (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  role text not null check (role in ('commercial','billing','technical','administrative','management')),
  primary key(contact_id,role)
);
create table public.leads (
  id uuid primary key default gen_random_uuid(), source text not null check(source in ('web','instagram','whatsapp','email','referral','outbound','other')),
  name text not null, company text not null, email text not null, phone text, raw_need_description text not null,
  systems text[] not null default '{}', api_knowledge text not null default 'unknown' check(api_knowledge in ('yes','no','unknown')),
  people_involved integer, hours_per_month numeric, monthly_volume bigint, primary_goal text not null,
  consent_given boolean not null, status text not null default 'new', score integer not null default 0 check(score between 0 and 100),
  owner_user_id uuid references public.profiles(id), converted_account_id uuid references public.accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.opportunities (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id), stage text not null default 'new', title text not null, problem_summary text,
  expected_value bigint check(expected_value >= 0), probability smallint check(probability between 0 and 100), expected_close_date date,
  next_action text, next_action_at timestamptz, lost_reason text, owner_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.activities (
  id uuid primary key default gen_random_uuid(), opportunity_id uuid references public.opportunities(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade, contact_id uuid references public.contacts(id) on delete set null,
  type text not null check(type in ('call','email','whatsapp','instagram','meeting','note','task','system')),
  direction text not null check(direction in ('inbound','outbound','internal')), subject text, body text, occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id), external_message_id text, created_at timestamptz not null default now()
);
create table public.solution_catalog (
  id uuid primary key default gen_random_uuid(), name text not null, category text not null, description text,
  default_days numeric not null check(default_days > 0), default_complexity text not null, reusable_template_key text,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(), version text not null unique, day_rate bigint not null check(day_rate > 0),
  min_implementation bigint not null check(min_implementation > 0), min_maintenance bigint not null check(min_maintenance > 0),
  complexity_tiers jsonb not null, maintenance_brackets jsonb not null, expansion_discount_tiers jsonb not null,
  rounding_multiple integer not null default 1000, effective_from date not null, published_at timestamptz, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.client_solutions (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  catalog_solution_id uuid references public.solution_catalog(id), name text not null, problem_statement text, scope text,
  status public.solution_status not null default 'proposed', start_date date, go_live_date date, estimated_days numeric not null,
  actual_days numeric, complexity_factor numeric not null, day_rate_snapshot bigint not null, gross_implementation_price bigint not null,
  expansion_discount_percent numeric not null default 0, net_implementation_price bigint not null,
  gross_maintenance_increment bigint not null, maintenance_discount_percent numeric not null default 0,
  net_maintenance_increment bigint not null, pricing_snapshot jsonb not null, owner_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.implementation_tasks (
  id uuid primary key default gen_random_uuid(), client_solution_id uuid not null references public.client_solutions(id) on delete cascade,
  title text not null, status text not null default 'pending', assignee uuid references public.profiles(id), estimate_hours numeric,
  actual_hours numeric, due_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.third_party_cost_items (
  id uuid primary key default gen_random_uuid(), client_solution_id uuid not null references public.client_solutions(id) on delete cascade,
  provider text not null, description text not null, cost numeric not null check(cost >= 0), currency text not null,
  periodicity text not null, paid_by text not null check(paid_by in ('client_direct','rebilled')), markup_percent numeric not null default 0,
  starts_at date not null, ends_at date, documentation_url text, created_at timestamptz not null default now()
);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null, billing_day smallint not null check(billing_day between 1 and 28), currency text not null default 'CLP',
  payment_method_type text, payment_provider_customer_id text, started_at date not null, cancelled_at date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.subscription_items (
  id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  client_solution_id uuid references public.client_solutions(id), type text not null check(type in ('maintenance','third_party','manual_adjustment')),
  name text not null, quantity numeric not null default 1, unit_amount bigint not null, discount_percent numeric not null default 0,
  net_amount bigint not null, third_party boolean not null default false, starts_at date not null, ends_at date, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint third_party_has_no_expansion_discount check(not third_party or discount_percent = 0)
);
create table public.billing_periods (
  id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_start date not null, period_end date not null, due_date date not null, amount_due bigint not null check(amount_due >= 0),
  amount_paid bigint not null default 0 check(amount_paid >= 0), status public.billing_status not null default 'upcoming',
  pricing_snapshot jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(subscription_id,period_start,period_end)
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), billing_period_id uuid not null references public.billing_periods(id) on delete cascade,
  provider text, external_id text, number text, issue_date date, status text not null, document_url text,
  created_at timestamptz not null default now(), unique(provider,external_id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), billing_period_id uuid not null references public.billing_periods(id) on delete cascade,
  provider text not null, external_payment_id text not null, amount bigint not null check(amount >= 0), currency text not null,
  status public.payment_status not null default 'pending', paid_at timestamptz, raw_provider_payload jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(provider,external_payment_id)
);
create table public.payment_events (
  id uuid primary key default gen_random_uuid(), provider text not null, external_event_id text not null,
  payment_id uuid references public.payments(id), normalized_payload jsonb not null, received_at timestamptz not null default now(),
  unique(provider,external_event_id)
);
create table public.payment_reminders (
  id uuid primary key default gen_random_uuid(), billing_period_id uuid not null references public.billing_periods(id) on delete cascade,
  scheduled_at timestamptz not null, channel text not null, template_key text not null, template_version text not null default 'v1',
  status text not null default 'scheduled', sent_at timestamptz, cancelled_at timestamptz, contact_id uuid references public.contacts(id),
  created_at timestamptz not null default now()
);
create table public.channels (
  id uuid primary key default gen_random_uuid(), type text not null check(type in ('email','whatsapp','instagram','web')),
  provider text not null, status text not null, external_identifier text, created_at timestamptz not null default now()
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(), account_id uuid references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id), lead_id uuid references public.leads(id), channel_id uuid not null references public.channels(id),
  status text not null, assigned_to uuid references public.profiles(id), last_message_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  external_id text, direction text not null, sender_ref text, body text, message_type text not null, sent_at timestamptz not null,
  delivery_status text, metadata jsonb not null default '{}', created_at timestamptz not null default now(),
  unique(conversation_id,external_id)
);
create table public.integrations (
  id uuid primary key default gen_random_uuid(), account_id uuid references public.accounts(id) on delete cascade,
  provider text not null, type text not null, status text not null, display_name text not null, external_account_identifier text,
  credential_reference text, last_health_check_at timestamptz, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.credential_metadata (
  id uuid primary key default gen_random_uuid(), integration_id uuid not null references public.integrations(id) on delete cascade,
  secret_reference text not null, auth_type text not null, expires_at timestamptz, scopes text[], rotated_at timestamptz,
  last_accessed_at timestamptz, created_at timestamptz not null default now()
);
create table public.audit_log (
  id bigint generated always as identity primary key, actor_user_id uuid references public.profiles(id), account_id uuid references public.accounts(id),
  entity_type text not null, entity_id text not null, action text not null, before_data jsonb, after_data jsonb,
  ip inet, user_agent text, created_at timestamptz not null default now()
);
create table public.marketing_spend (
  id uuid primary key default gen_random_uuid(), period date not null, channel text not null, amount bigint not null check(amount >= 0),
  notes text, created_at timestamptz not null default now(), unique(period,channel)
);

create index contacts_account_idx on public.contacts(account_id);
create index leads_status_created_idx on public.leads(status,created_at desc);
create index opportunities_account_stage_idx on public.opportunities(account_id,stage);
create index client_solutions_account_status_idx on public.client_solutions(account_id,status);
create index subscriptions_account_idx on public.subscriptions(account_id);
create index billing_periods_due_status_idx on public.billing_periods(due_date,status);
create index reminders_schedule_status_idx on public.payment_reminders(scheduled_at,status);
create index conversations_account_last_idx on public.conversations(account_id,last_message_at desc);
create index audit_account_created_idx on public.audit_log(account_id,created_at desc);

create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['accounts','profiles','contacts','leads','opportunities','solution_catalog','client_solutions','implementation_tasks','subscriptions','billing_periods','payments','conversations','integrations'] loop execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()',t,t); end loop; end $$;
