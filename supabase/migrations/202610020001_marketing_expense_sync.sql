-- Gastos importados automáticamente desde plataformas de anuncios (por ahora Meta Ads). Cada fila
-- importada lleva una referencia única (plataforma, campaña, día y ubicación) para que volver a
-- sincronizar un día actualice el gasto en vez de duplicarlo.
alter table public.marketing_expenses
  add column if not exists source text not null default 'manual' check (source in ('manual', 'meta_ads')),
  add column if not exists external_ref text check (external_ref is null or char_length(external_ref) between 3 and 200);

alter table public.marketing_expenses
  add constraint marketing_expenses_external_ref_key unique (external_ref);

comment on column public.marketing_expenses.source is
  'manual = registrado por el equipo; meta_ads = importado del administrador de anuncios de Meta.';
comment on column public.marketing_expenses.external_ref is
  'Clave del gasto en la plataforma de origen (p. ej. meta:<campaña>:<día>:<ubicación>); vacía en gastos manuales.';
