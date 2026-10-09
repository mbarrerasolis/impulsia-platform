-- Chat del sitio con el asistente: su costo de IA se registra con propósito 'web' (además de WhatsApp y
-- la vista previa del panel). Las conversaciones usan el canal existente de tipo 'web'.
alter table public.ai_usage_events drop constraint if exists ai_usage_events_purpose_check;
alter table public.ai_usage_events add constraint ai_usage_events_purpose_check check (purpose in ('whatsapp', 'preview', 'web'));
