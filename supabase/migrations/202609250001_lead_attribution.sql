-- Origen de marketing de cada lead (UTM, clic de anuncio de Meta o sitio de referencia).
-- Lo envía el formulario público; el tope de tamaño evita que un cliente anónimo guarde datos arbitrarios.
alter table public.leads
  add column if not exists attribution jsonb
  check (attribution is null or (jsonb_typeof(attribution) = 'object' and pg_column_size(attribution) <= 4096));

comment on column public.leads.attribution is
  'Origen de marketing: utmSource, utmMedium, utmCampaign, utmContent, utmTerm, fbclid, referrer, landingPath, capturedAt.';
