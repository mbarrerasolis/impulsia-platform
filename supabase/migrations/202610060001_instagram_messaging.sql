-- Mensajes directos de Instagram atendidos por el asistente: su costo de IA se registra con propósito 'instagram'.
-- Incluye 'web' por si la edición aún no aplicó 202610050001_web_chat.sql. Los canales de tipo 'instagram' y los
-- leads con origen 'instagram' ya existían en el esquema inicial.
alter table public.ai_usage_events drop constraint if exists ai_usage_events_purpose_check;
alter table public.ai_usage_events add constraint ai_usage_events_purpose_check check (purpose in ('whatsapp', 'preview', 'web', 'instagram'));
