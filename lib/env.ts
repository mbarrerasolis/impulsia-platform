import "server-only";
import { z } from "zod";

const optionalSetting = (schema: z.ZodType<string>) =>
  z.preprocess((value) => value === "" ? undefined : value, schema.optional());

const baseSchema = z.object({
  APP_MODE: z.enum(["demo", "supabase"]).default("demo"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: optionalSetting(z.url()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalSetting(z.string().min(1)),
  SUPABASE_SECRET_KEY: optionalSetting(z.string().min(1)),
  SUPABASE_SERVICE_ROLE_KEY: optionalSetting(z.string().min(1)),
  PAYMENT_PROVIDER: z.enum(["mock", "mercadopago", "flow"]).default("mock"),
  FLOW_API_KEY: optionalSetting(z.string().min(1)),
  FLOW_SECRET_KEY: optionalSetting(z.string().min(1)),
  FLOW_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  EMAIL_PROVIDER: z.enum(["mock", "resend"]).default("mock"),
  RESEND_API_KEY: optionalSetting(z.string().min(1)),
  EMAIL_FROM: optionalSetting(z.string().min(3)),
  AI_PROVIDER: z.enum(["disabled", "anthropic"]).default("disabled"),
  ANTHROPIC_API_KEY: optionalSetting(z.string().min(1)),
  AI_MODEL: z.string().min(1).default("claude-sonnet-5"),
  AI_DAILY_BUDGET_USD: z.coerce.number().positive().max(1_000).default(2),
  AI_MAX_REPLIES_PER_CONVERSATION_DAY: z.coerce.number().int().positive().max(500).default(30),
  AI_MAX_MESSAGES_PER_SENDER_MINUTE: z.coerce.number().int().positive().max(100).default(10),
  AI_MAX_MESSAGES_PER_SENDER_DAY: z.coerce.number().int().positive().max(2_000).default(50),
  /** Notas de voz de WhatsApp: con esta clave el asistente transcribe audios y puede responder con voz. */
  OPENAI_API_KEY: optionalSetting(z.string().min(20)),
  OPENAI_TRANSCRIBE_MODEL: z.string().min(1).default("gpt-4o-mini-transcribe"),
  OPENAI_TTS_MODEL: z.string().min(1).default("gpt-4o-mini-tts"),
  OPENAI_TTS_VOICE: z.string().min(1).default("marin"),
  /** Voz de las respuestas con acento chileno real; sin clave y voz, se usa la de OpenAI. */
  ELEVENLABS_API_KEY: optionalSetting(z.string().min(20)),
  ELEVENLABS_VOICE_ID: optionalSetting(z.string().regex(/^[A-Za-z0-9]{10,40}$/)),
  ELEVENLABS_MODEL: z.string().min(1).default("eleven_multilingual_v2"),
  /** Si el cliente manda una nota de voz, el asistente contesta con otra (además del texto si trae datos). */
  ASSISTANT_VOICE_REPLIES: z.enum(["true", "false"]).default("true"),
  /** Segundos que el asistente espera antes de responder, para contestar de una vez varios mensajes seguidos. */
  ASSISTANT_BATCH_SECONDS: z.coerce.number().min(0).max(30).default(6),
  SECRET_STORE_PROVIDER:z.enum(["local-memory", "vault"]).default("local-memory"),
  NEXT_PUBLIC_WHATSAPP_NUMBER: optionalSetting(z.string().regex(/^\d{8,15}$/)),
  NEXT_PUBLIC_WHATSAPP_MESSAGE: optionalSetting(z.string().max(500)),
  WHATSAPP_VERIFY_TOKEN: optionalSetting(z.string().min(16)),
  WHATSAPP_APP_SECRET: optionalSetting(z.string().min(16)),
  WHATSAPP_ACCESS_TOKEN: optionalSetting(z.string().min(20)),
  WHATSAPP_PHONE_NUMBER_ID: optionalSetting(z.string().regex(/^\d+$/)),
  WHATSAPP_GRAPH_VERSION: optionalSetting(z.string().regex(/^v\d+\.\d+$/)),
  /** Identificador de la cuenta de WhatsApp Business (no secreto); se usa para suscribirla a la app. */
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalSetting(z.string().regex(/^\d+$/)),
  WHATSAPP_BOT_ENABLED: z.enum(["true", "false"]).default("false"),
  /** Mensajes directos de Instagram (API de Instagram con inicio de sesión de Instagram). */
  INSTAGRAM_BOT_ENABLED: z.enum(["true", "false"]).default("false"),
  INSTAGRAM_ACCESS_TOKEN: optionalSetting(z.string().min(20)),
  /** Id de la cuenta profesional de Instagram que recibe los mensajes (IG_ID). */
  INSTAGRAM_ACCOUNT_ID: optionalSetting(z.string().regex(/^\d+$/)),
  /** Secreto de la app de Instagram con que Meta firma el webhook; si falta, se usa WHATSAPP_APP_SECRET. */
  INSTAGRAM_APP_SECRET: optionalSetting(z.string().min(16)),
  INSTAGRAM_VERIFY_TOKEN: optionalSetting(z.string().min(16)),
  INSTAGRAM_GRAPH_VERSION: z.string().regex(/^v\d+\.\d+$/).default("v25.0"),
  /** Píxel de Meta (público). Sólo se carga en el navegador si la persona acepta cookies de publicidad. */
  NEXT_PUBLIC_META_PIXEL_ID: optionalSetting(z.string().regex(/^\d{10,20}$/)),
  /** Token de Conversions API (secreto); sin él los eventos quedan sólo en el navegador. */
  META_CAPI_ACCESS_TOKEN: optionalSetting(z.string().min(20)),
  /** Código de "Probar eventos" del Administrador de eventos; quitarlo tras validar. */
  META_CAPI_TEST_EVENT_CODE: optionalSetting(z.string().min(3).max(40)),
  /** Cuenta publicitaria de Meta (id numérico, sin "act_"; no secreto) cuyo gasto se importa a Campañas y gastos. */
  META_AD_ACCOUNT_ID: optionalSetting(z.string().regex(/^\d{5,25}$/)),
  /** Token de usuario del sistema con permiso ads_read (secreto); sin él no se sincroniza el gasto. */
  META_ADS_ACCESS_TOKEN: optionalSetting(z.string().min(20)),
  /** Días hacia atrás que se re-sincronizan cada vez (Meta ajusta el gasto de los últimos días). */
  META_ADS_SYNC_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  /** Secreto que Vercel Cron manda como "Bearer" a las tareas programadas. */
  CRON_SECRET: optionalSetting(z.string().min(16)),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalSetting(z.string().min(1)),
  TURNSTILE_SECRET_KEY: optionalSetting(z.string().min(1)),
  ASSISTANT_SCHEDULING_ENABLED: z.enum(["true", "false"]).default("false"),
  GOOGLE_CALENDAR_CLIENT_ID: optionalSetting(z.string().min(1)),
  GOOGLE_CALENDAR_CLIENT_SECRET: optionalSetting(z.string().min(1)),
  GOOGLE_CALENDAR_REFRESH_TOKEN: optionalSetting(z.string().min(1)),
  GOOGLE_CALENDAR_ID: z.string().min(1).default("primary"),
  ASSISTANT_TIME_ZONE: z.string().min(1).default("America/Santiago"),
  ASSISTANT_BUSINESS_HOURS: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/).default("09:00-18:00"),
  ASSISTANT_BUSINESS_DAYS: z.string().regex(/^[0-6](,\s*[0-6])*$/).default("1,2,3,4,5"),
  ASSISTANT_MEETING_MINUTES: z.coerce.number().int().min(15).max(120).default(30),
  ASSISTANT_MEETING_NOTICE_MINUTES: z.coerce.number().int().min(0).max(7 * 24 * 60).default(120),
  ASSISTANT_MEETING_HORIZON_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  /** Seguimiento automático de conversaciones pausadas; el webhook espera este plazo antes de revisar (tope 4 por el límite de 300 s de las funciones). */
  ASSISTANT_FOLLOW_UP_ENABLED: z.enum(["true", "false"]).default("false"),
  ASSISTANT_FOLLOW_UP_MINUTES: z.coerce.number().min(1).max(4).default(4),
  /** Pesos chilenos por dólar para sumar el gasto de IA (USD) y los gastos en dólares al reporte de campañas. */
  MARKETING_USD_CLP_RATE: z.coerce.number().positive().max(100_000).default(950)
});

export type ServerEnv = z.infer<typeof baseSchema>;

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = baseSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuración inválida: ${z.prettifyError(result.error)}`);
  }
  if (result.data.APP_MODE === "supabase" && (
    !result.data.NEXT_PUBLIC_SUPABASE_URL ||
    !result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )) {
    throw new Error("APP_MODE=supabase requiere NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  if (result.data.PAYMENT_PROVIDER === "flow" && (!result.data.FLOW_API_KEY || !result.data.FLOW_SECRET_KEY)) {
    throw new Error("PAYMENT_PROVIDER=flow requiere FLOW_API_KEY y FLOW_SECRET_KEY.");
  }
  if (result.data.EMAIL_PROVIDER === "resend" && (!result.data.RESEND_API_KEY || !result.data.EMAIL_FROM)) {
    throw new Error("EMAIL_PROVIDER=resend requiere RESEND_API_KEY y EMAIL_FROM.");
  }
  if (result.data.AI_PROVIDER === "anthropic" && !result.data.ANTHROPIC_API_KEY) {
    throw new Error("AI_PROVIDER=anthropic requiere ANTHROPIC_API_KEY.");
  }
  if (result.data.WHATSAPP_BOT_ENABLED === "true" && (
    !result.data.WHATSAPP_APP_SECRET ||
    !result.data.WHATSAPP_ACCESS_TOKEN ||
    !result.data.WHATSAPP_PHONE_NUMBER_ID ||
    !result.data.WHATSAPP_GRAPH_VERSION
  )) {
    throw new Error("WHATSAPP_BOT_ENABLED=true requiere secreto, token, phone number id y versión de Graph API.");
  }
  if (Boolean(result.data.NEXT_PUBLIC_TURNSTILE_SITE_KEY) !== Boolean(result.data.TURNSTILE_SECRET_KEY)) {
    // Con sólo una de las dos, el formulario rechazaría todo (o no mostraría el widget que se exige).
    throw new Error("Turnstile requiere NEXT_PUBLIC_TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY juntas.");
  }
  if (result.data.ASSISTANT_SCHEDULING_ENABLED === "true" && (
    !result.data.GOOGLE_CALENDAR_CLIENT_ID ||
    !result.data.GOOGLE_CALENDAR_CLIENT_SECRET ||
    !result.data.GOOGLE_CALENDAR_REFRESH_TOKEN
  )) {
    throw new Error("ASSISTANT_SCHEDULING_ENABLED=true requiere GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET y GOOGLE_CALENDAR_REFRESH_TOKEN.");
  }
  return result.data;
}
