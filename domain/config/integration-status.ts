/**
 * Estado de las integraciones de una edición a partir de su configuración (sólo si cada variable
 * existe, nunca su valor). Alimenta /admin/integrations: qué está conectado, qué falta y para qué sirve.
 */
export type IntegrationState = "ok" | "partial" | "off";

export interface IntegrationStatus {
  key: string;
  name: string;
  purpose: string;
  state: IntegrationState;
  detail: string;
  /** Variables o pasos que faltan (nombres, nunca valores). */
  missing: string[];
}

export interface IntegrationInput {
  env: Record<string, string | number | undefined>;
  modules: { whatsapp: boolean; store: boolean; meetings: boolean; subscriptions: boolean };
  /** Asistente configurado en la edición (nombre y si ya tiene estilo propio). */
  assistant?: { name?: string; hasStyle: boolean };
}

const has = (env: IntegrationInput["env"], ...keys: string[]) => keys.filter((key) => !env[key]);

export function integrationStatuses({ env, modules, assistant }: IntegrationInput): IntegrationStatus[] {
  const list: IntegrationStatus[] = [];
  const database = env.APP_MODE === "supabase";
  list.push({ key: "database", name: "Base de datos (Supabase)", purpose: "Guarda leads, conversaciones, inventario, reseñas y usuarios.", state: database ? "ok" : "off", detail: database ? "Conectada." : "Modo demostración: los datos se pierden al reiniciar.", missing: database ? [] : ["APP_MODE=supabase"] });

  const aiMissing = [...(env.AI_PROVIDER === "anthropic" ? [] : ["AI_PROVIDER=anthropic"]), ...has(env, "ANTHROPIC_API_KEY")];
  const ai = aiMissing.length === 0;
  const persona = assistant?.name ?? "El asistente";
  list.push({
    key: "assistant", name: `${persona} (asistente con IA)`, purpose: modules.store ? "Atiende WhatsApp y el chat del sitio: busca productos, cotiza con los tramos y registra pedidos." : "Atiende WhatsApp: califica, estima precios y agenda reuniones.",
    state: ai ? (assistant && !assistant.hasStyle ? "partial" : "ok") : "off",
    detail: ai ? `Modelo ${env.AI_MODEL ?? "por defecto"} · presupuesto diario US$${env.AI_DAILY_BUDGET_USD ?? "—"}${assistant && !assistant.hasStyle ? " · usando el estilo neutro (falta definir el estilo propio)" : ""}.` : "Sin IA: WhatsApp usa el guion básico y el chat del sitio no aparece.",
    missing: [...aiMissing, ...(ai && assistant && !assistant.hasStyle ? ["Estilo del asistente (storefront.assistant.style)"] : [])],
  });

  if (modules.store) {
    const chatReady = ai && database;
    list.push({ key: "web-chat", name: "Chat del sitio", purpose: "Botón de chat en la tienda; las conversaciones llegan a la bandeja junto con WhatsApp.", state: chatReady ? "ok" : "off", detail: chatReady ? "Visible en la tienda." : "Se activa solo cuando hay base de datos y asistente con IA.", missing: chatReady ? [] : ["Base de datos y asistente con IA"] });
  }

  if (modules.whatsapp) {
    const apiMissing = has(env, "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET");
    const button = Boolean(env.NEXT_PUBLIC_WHATSAPP_NUMBER);
    const bot = env.WHATSAPP_BOT_ENABLED === "true";
    list.push({
      key: "whatsapp", name: "WhatsApp Business", purpose: "Botón de WhatsApp, envío de pedidos y respuestas automáticas del asistente.",
      state: !apiMissing.length && button ? (bot ? "ok" : "partial") : button || !apiMissing.length ? "partial" : "off",
      detail: [button ? "Botón y pedidos por WhatsApp activos" : "Sin número público: los pedidos se envían por correo", apiMissing.length ? "API de Meta sin conectar" : bot ? "asistente respondiendo" : "asistente apagado (WHATSAPP_BOT_ENABLED)"].join(" · ") + ".",
      missing: [...(button ? [] : ["NEXT_PUBLIC_WHATSAPP_NUMBER"]), ...apiMissing, ...(!apiMissing.length && !bot ? ["WHATSAPP_BOT_ENABLED=true"] : [])],
    });
  }

  const emailMissing = [...(env.EMAIL_PROVIDER === "resend" ? [] : ["EMAIL_PROVIDER=resend"]), ...has(env, "RESEND_API_KEY", "EMAIL_FROM")];
  list.push({ key: "email", name: "Correo (Resend)", purpose: "Avisos al equipo de pedidos, leads y derivaciones; invitaciones de usuarios.", state: emailMissing.length ? "off" : "ok", detail: emailMissing.length ? "Modo prueba: los correos no se envían." : `Envía desde ${env.EMAIL_FROM}.`, missing: emailMissing });

  if (modules.store || modules.subscriptions) {
    const flowMissing = [...(env.PAYMENT_PROVIDER === "flow" ? [] : ["PAYMENT_PROVIDER=flow"]), ...has(env, "FLOW_API_KEY", "FLOW_SECRET_KEY")];
    list.push({ key: "payments", name: "Pagos (Flow)", purpose: modules.store ? "Cobro en línea de pedidos (webpay y tarjetas)." : "Cobro de cuotas y suscripciones.", state: flowMissing.length ? "off" : env.FLOW_ENVIRONMENT === "production" ? "ok" : "partial", detail: flowMissing.length ? (modules.store ? "Aún sin pago en línea: el equipo confirma y cobra cada pedido." : "Pagos simulados.") : `Flow en ${env.FLOW_ENVIRONMENT ?? "sandbox"}.`, missing: flowMissing });
  }

  const turnstileMissing = has(env, "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY");
  list.push({ key: "captcha", name: "Protección anti-bots (Turnstile)", purpose: "Verifica que los formularios del sitio los envíe una persona.", state: turnstileMissing.length ? "partial" : "ok", detail: turnstileMissing.length ? "Sólo campo trampa y tiempo mínimo." : "Activa.", missing: turnstileMissing });

  const pixel = Boolean(env.NEXT_PUBLIC_META_PIXEL_ID);
  const capi = Boolean(env.META_CAPI_ACCESS_TOKEN);
  const ads = Boolean(env.META_AD_ACCOUNT_ID && env.META_ADS_ACCESS_TOKEN);
  list.push({ key: "meta", name: "Meta (píxel, conversiones y gasto)", purpose: "Mide visitas y leads de los anuncios e importa el gasto diario a Campañas.", state: pixel && capi && ads ? "ok" : pixel || capi || ads ? "partial" : "off", detail: `Píxel ${pixel ? "sí" : "no"} · API de conversiones ${capi ? "sí" : "no"} · gasto automático ${ads ? "sí" : "no"}.`, missing: [...(pixel ? [] : ["NEXT_PUBLIC_META_PIXEL_ID"]), ...(capi ? [] : ["META_CAPI_ACCESS_TOKEN"]), ...(ads ? [] : ["META_AD_ACCOUNT_ID", "META_ADS_ACCESS_TOKEN"])] });

  if (modules.meetings) {
    const calendarMissing = [...(env.ASSISTANT_SCHEDULING_ENABLED === "true" ? [] : ["ASSISTANT_SCHEDULING_ENABLED=true"]), ...has(env, "GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CALENDAR_REFRESH_TOKEN")];
    list.push({ key: "calendar", name: "Agenda (Google Calendar)", purpose: "El asistente ofrece horarios y agenda reuniones con Meet.", state: calendarMissing.length ? "off" : "ok", detail: calendarMissing.length ? "Sin agenda: el asistente registra y deriva." : `Calendario ${env.GOOGLE_CALENDAR_ID ?? "primary"}.`, missing: calendarMissing });
  }
  return list;
}
