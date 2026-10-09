-- Ventas de la tienda (fase B): cotización COT-AAAA-NNNNN con versiones que no se editan, pedido
-- PED-AAAA-NNNNN al elegir la forma de pago, pagos (transferencias en revisión) e historial de estados.
-- Las escribe sólo el servidor (asistente o panel, con la clave de servicio, después de validar el rol);
-- el equipo interno las lee bajo RLS.

create table if not exists public.store_sale_counters (
  prefix text not null check (prefix in ('COT', 'PED')),
  year integer not null check (year between 2020 and 2200),
  last_value integer not null default 0 check (last_value >= 0),
  primary key (prefix, year)
);

create table if not exists public.store_sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  number text not null unique check (number ~ '^COT-[0-9]{4}-[0-9]{5,}$'),
  order_number text unique check (order_number ~ '^PED-[0-9]{4}-[0-9]{5,}$'),
  status text not null check (status in ('quote_draft', 'quote_sent', 'quote_revised', 'quote_accepted', 'payment_pending',
    'payment_in_review', 'paid', 'preparing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled')),
  lead_id uuid references public.leads(id) on delete set null,
  conversation_id uuid,
  customer jsonb not null check (jsonb_typeof(customer) = 'object'),
  destination text not null default '' check (char_length(destination) <= 200),
  delivery_mode text not null default 'por_definir' check (delivery_mode in ('despacho', 'retiro', 'por_definir')),
  carrier text check (char_length(carrier) <= 120),
  payment_method text check (payment_method in ('transfer', 'gateway')),
  document text check (document in ('boleta', 'factura')),
  billing jsonb check (billing is null or jsonb_typeof(billing) = 'object'),
  tracking text check (char_length(tracking) <= 300),
  notes text check (char_length(notes) <= 2000),
  current_version integer not null default 1 check (current_version >= 1)
);

create index if not exists store_sales_status_idx on public.store_sales (status, updated_at desc);
create index if not exists store_sales_lead_idx on public.store_sales (lead_id);
create index if not exists store_sales_conversation_idx on public.store_sales (conversation_id) where conversation_id is not null;
create trigger touch_store_sales before update on public.store_sales for each row execute function public.touch_updated_at();

create table if not exists public.store_quote_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sale_id uuid not null references public.store_sales(id) on delete cascade,
  version integer not null check (version >= 1),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 60),
  products_total integer not null check (products_total >= 0),
  net integer not null check (net >= 0),
  vat integer not null check (vat >= 0),
  shipping integer check (shipping >= 0),
  total integer not null check (total >= 0),
  valid_until timestamptz not null,
  notes text check (char_length(notes) <= 1000),
  changes text check (char_length(changes) <= 2000),
  created_via text not null check (created_via in ('assistant', 'panel')),
  created_by uuid references public.profiles(id),
  unique (sale_id, version)
);

create table if not exists public.store_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sale_id uuid not null references public.store_sales(id) on delete cascade,
  quote_version integer not null check (quote_version >= 1),
  method text not null check (method in ('transfer', 'gateway')),
  amount integer not null check (amount >= 0),
  expected_amount integer not null check (expected_amount >= 0),
  status text not null default 'in_review' check (status in ('in_review', 'approved', 'rejected')),
  payer text check (char_length(payer) <= 160),
  paid_on date,
  receipt_ref text check (char_length(receipt_ref) <= 300),
  note text check (char_length(note) <= 500),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_note text check (char_length(review_note) <= 500)
);

create index if not exists store_payments_sale_idx on public.store_payments (sale_id, created_at);

create table if not exists public.store_sale_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sale_id uuid not null references public.store_sales(id) on delete cascade,
  from_status text,
  to_status text not null,
  via text not null check (via in ('assistant', 'panel')),
  note text check (char_length(note) <= 500),
  actor uuid references public.profiles(id)
);

create index if not exists store_sale_events_sale_idx on public.store_sale_events (sale_id, created_at);

-- Lectura del equipo interno; nadie escribe con su sesión (todo pasa por el servidor).
alter table public.store_sale_counters enable row level security;
alter table public.store_sales enable row level security;
alter table public.store_quote_versions enable row level security;
alter table public.store_payments enable row level security;
alter table public.store_sale_events enable row level security;
create policy store_sales_internal_read on public.store_sales for select to authenticated using (public.is_internal());
create policy store_quote_versions_internal_read on public.store_quote_versions for select to authenticated using (public.is_internal());
create policy store_payments_internal_read on public.store_payments for select to authenticated using (public.is_internal());
create policy store_sale_events_internal_read on public.store_sale_events for select to authenticated using (public.is_internal());
revoke all on public.store_sale_counters from anon, authenticated;
revoke insert, update, delete on public.store_sales, public.store_quote_versions, public.store_payments, public.store_sale_events from anon, authenticated;

-- Siguiente correlativo del año, sin saltos por concurrencia (bloquea la fila del contador).
create or replace function public.next_store_sale_number(p_prefix text, p_year integer)
returns text
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_value integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'store_sales_not_allowed' using errcode = '42501';
  end if;
  insert into public.store_sale_counters (prefix, year, last_value) values (p_prefix, p_year, 1)
  on conflict (prefix, year) do update set last_value = public.store_sale_counters.last_value + 1
  returning last_value into v_value;
  return p_prefix || '-' || p_year || '-' || lpad(v_value::text, 5, '0');
end $$;

revoke all on function public.next_store_sale_number(text, integer) from public, anon, authenticated;
grant execute on function public.next_store_sale_number(text, integer) to service_role;

comment on table public.store_sales is 'Ventas de la tienda: cotización (COT) que pasa a pedido (PED). Estados según el manual del vendedor.';
comment on table public.store_quote_versions is 'Versiones de cada cotización; no se editan: un cambio crea la versión siguiente.';
comment on table public.store_payments is 'Pagos de una venta; una transferencia queda en revisión hasta que el equipo la aprueba.';
comment on table public.store_sale_events is 'Historial de estados de cada venta (quién: asistente o panel).';
