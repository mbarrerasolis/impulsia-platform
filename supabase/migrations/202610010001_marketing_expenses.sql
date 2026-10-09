-- Gastos comerciales (publicidad, mensajería, herramientas…) para medir el costo por lead, el CAC y
-- las métricas de anuncios de cada procedencia y campaña. El gasto del asistente con IA no se
-- registra aquí: se suma automáticamente desde ai_usage_events.
create table if not exists public.marketing_expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  category text not null check (category in ('advertising', 'ai', 'messaging', 'tools', 'content', 'other')),
  channel text check (channel in ('instagram', 'facebook', 'meta', 'google', 'tiktok', 'linkedin', 'whatsapp', 'email', 'referral', 'web', 'other')),
  campaign text check (campaign is null or char_length(campaign) between 1 and 150),
  description text not null check (char_length(description) between 2 and 200),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'CLP' check (currency in ('CLP', 'USD')),
  recurrence text not null default 'once' check (recurrence in ('once', 'monthly')),
  ends_on date,
  -- Resultados del anuncio informados por la plataforma (Meta, Google…): visualizaciones y clics.
  impressions integer check (impressions is null or impressions >= 0),
  clicks integer check (clicks is null or clicks >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint marketing_expenses_ends_after_start check (ends_on is null or ends_on >= spent_on),
  constraint marketing_expenses_metrics_once check (recurrence = 'once' or (impressions is null and clicks is null))
);

create index if not exists marketing_expenses_spent_on_idx on public.marketing_expenses(spent_on desc);

alter table public.marketing_expenses enable row level security;
create policy marketing_expenses_internal_all on public.marketing_expenses
  for all to authenticated using (public.is_internal()) with check (public.is_internal());

comment on table public.marketing_expenses is
  'Gastos comerciales registrados por el equipo; los mensuales se repiten cada mes desde spent_on hasta ends_on.';

-- Visitas al sitio público: una fila por sesión de navegación, anónima (sin IP, sin navegador, sin
-- cookies). Sirve para la conversión visita → lead por procedencia y campaña.
create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique check (char_length(session_id) between 16 and 64),
  visited_at timestamptz not null default now(),
  utm_source text check (char_length(utm_source) <= 100),
  utm_medium text check (char_length(utm_medium) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 150),
  referrer text check (char_length(referrer) <= 200),
  fbclid boolean not null default false,
  landing_path text check (char_length(landing_path) <= 300)
);

create index if not exists site_visits_visited_at_idx on public.site_visits(visited_at desc);

-- Las inserta el servidor con la clave de servicio; el equipo interno sólo lee.
alter table public.site_visits enable row level security;
create policy site_visits_internal_read on public.site_visits
  for select to authenticated using (public.is_internal());

comment on table public.site_visits is
  'Sesiones anónimas del sitio público con su origen (UTM/referrer) para medir conversión; sin datos personales.';
