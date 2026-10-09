-- Reseñas de clientes de la tienda. Entran "pending" desde el sitio y sólo se publican cuando el
-- equipo las aprueba. El contacto (correo o teléfono) sirve para verificar la compra y nunca se publica.
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 600),
  author_name text not null check (char_length(author_name) between 2 and 60),
  product_label text check (char_length(product_label) <= 120),
  contact text check (char_length(contact) <= 120),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source text not null default 'web' check (source in ('web', 'imported')),
  moderated_at timestamptz,
  moderated_by uuid references public.profiles(id)
);

create index if not exists product_reviews_status_created_idx on public.product_reviews(status, created_at desc);

-- Las inserta y publica el servidor con la clave de servicio; el equipo interno las lee y modera.
alter table public.product_reviews enable row level security;
create policy product_reviews_internal_read on public.product_reviews
  for select to authenticated using (public.is_internal());
create policy product_reviews_internal_moderate on public.product_reviews
  for update to authenticated using (public.is_internal()) with check (public.is_internal());

comment on table public.product_reviews is
  'Reseñas de clientes de la tienda; sólo las aprobadas se muestran en el sitio. contact es privado.';
