alter table public.conversations
  add column if not exists external_participant_id text,
  add column if not exists profile_name text,
  add column if not exists qualification_state text not null default 'new',
  add column if not exists bot_context jsonb not null default '{}'::jsonb,
  add column if not exists human_handoff_requested boolean not null default false;

create unique index if not exists channels_provider_external_identifier_uidx
  on public.channels(provider, external_identifier)
  where external_identifier is not null;

create unique index if not exists conversations_channel_participant_uidx
  on public.conversations(channel_id, external_participant_id)
  where external_participant_id is not null;

create index if not exists messages_sender_sent_idx
  on public.messages(sender_ref, sent_at desc);

comment on column public.conversations.external_participant_id is
  'Identificador del participante en el proveedor, por ejemplo wa_id en WhatsApp.';
comment on column public.conversations.qualification_state is
  'Paso actual del flujo determinista de calificación; no contiene secretos.';
comment on column public.conversations.bot_context is
  'Respuestas estructuradas del flujo de calificación, sin credenciales del proveedor.';
