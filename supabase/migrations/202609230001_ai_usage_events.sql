-- Registro del consumo del asistente con IA: una fila por mensaje respondido.
-- Sirve para el presupuesto diario, los topes por conversación y el resumen de gasto del panel.
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  purpose text not null check (purpose in ('whatsapp', 'preview')),
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_read_input_tokens integer not null default 0 check (cache_read_input_tokens >= 0),
  cache_creation_input_tokens integer not null default 0 check (cache_creation_input_tokens >= 0),
  model_calls integer not null default 1 check (model_calls >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_created_idx
  on public.ai_usage_events(created_at desc);
create index if not exists ai_usage_events_conversation_created_idx
  on public.ai_usage_events(conversation_id, created_at desc)
  where conversation_id is not null;

-- Las escrituras las hace el servidor con la clave de servicio; el equipo interno sólo lee.
alter table public.ai_usage_events enable row level security;
create policy ai_usage_events_internal_read on public.ai_usage_events
  for select to authenticated using (public.is_internal());

comment on table public.ai_usage_events is
  'Tokens y costo estimado en USD de cada respuesta del asistente con IA; no contiene el texto de los mensajes.';
