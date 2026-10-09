-- Inventario de la tienda (fase A, sin ERP). El catálogo (nombres, fotos, categorías, presentaciones)
-- vive en el manifiesto de la edición; aquí está lo comercial de cada presentación: SKU, precio, si se
-- vende y su stock. El stock sólo cambia con record_inventory_movement, que deja el movimiento.
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- "<producto>::<presentación>" según el manifiesto (presentación vacía si el producto no tiene).
  variant_key text not null unique check (char_length(variant_key) between 3 and 200 and position('::' in variant_key) > 1),
  product_key text not null check (char_length(product_key) between 1 and 80),
  product_name text not null check (char_length(product_name) between 2 and 120),
  format_label text not null default '' check (char_length(format_label) <= 40),
  sku text check (sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'),
  price integer check (price > 0 and price <= 100000000),
  active boolean not null default true,
  track_stock boolean not null default false,
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold between 0 and 100000)
);

create unique index if not exists product_variants_sku_unique on public.product_variants (upper(sku)) where sku is not null;
create trigger touch_product_variants before update on public.product_variants for each row execute function public.touch_updated_at();

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity <> 0),
  reason text not null check (reason in ('purchase', 'adjustment', 'waste', 'return', 'sale')),
  note text check (char_length(note) <= 200),
  stock_after integer not null check (stock_after >= 0),
  created_by uuid references public.profiles(id)
);

create index if not exists inventory_movements_created_idx on public.inventory_movements (created_at desc);
create index if not exists inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

-- El equipo interno lee y edita lo comercial; nadie escribe el stock ni los movimientos directamente.
alter table public.product_variants enable row level security;
alter table public.inventory_movements enable row level security;
create policy product_variants_internal_read on public.product_variants
  for select to authenticated using (public.is_internal());
create policy product_variants_internal_insert on public.product_variants
  for insert to authenticated with check (public.is_internal());
create policy product_variants_internal_update on public.product_variants
  for update to authenticated using (public.is_internal()) with check (public.is_internal());
create policy inventory_movements_internal_read on public.inventory_movements
  for select to authenticated using (public.is_internal());

revoke insert, update, delete on public.product_variants from anon, authenticated;
grant insert (variant_key, product_key, product_name, format_label, sku, price, active, track_stock, low_stock_threshold) on public.product_variants to authenticated;
grant update (variant_key, product_key, product_name, format_label, sku, price, active, track_stock, low_stock_threshold) on public.product_variants to authenticated;
revoke insert, update, delete on public.inventory_movements from anon, authenticated;

create or replace function public.record_inventory_movement(p_variant_id uuid, p_quantity integer, p_reason text, p_note text default null)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_stock integer;
begin
  if not (public.is_internal() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'inventory_not_allowed' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity = 0 then
    raise exception 'inventory_quantity_zero' using errcode = '22023';
  end if;
  select stock into v_stock from public.product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'inventory_variant_not_found' using errcode = 'P0002';
  end if;
  v_stock := v_stock + p_quantity;
  if v_stock < 0 then
    raise exception 'inventory_insufficient_stock' using errcode = '23514';
  end if;
  -- El primer movimiento activa el control de stock de la presentación.
  update public.product_variants set stock = v_stock, track_stock = true where id = p_variant_id;
  insert into public.inventory_movements (variant_id, quantity, reason, note, stock_after, created_by)
  values (p_variant_id, p_quantity, p_reason, nullif(trim(p_note), ''), v_stock, auth.uid());
  return v_stock;
end $$;

revoke all on function public.record_inventory_movement(uuid, integer, text, text) from public, anon;
grant execute on function public.record_inventory_movement(uuid, integer, text, text) to authenticated, service_role;

comment on table public.product_variants is
  'Lo comercial de cada presentación del catálogo de la edición (SKU, precio, activo, stock). El stock cambia sólo con record_inventory_movement.';
comment on table public.inventory_movements is
  'Historial de cambios de stock (ingresos, conteos, mermas, devoluciones, ventas); stock_after deja el saldo.';
