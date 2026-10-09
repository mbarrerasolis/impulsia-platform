import type { Route } from "next";
import Link from "next/link";
import { Bot, CheckCircle2, CircleDashed, FlaskConical, MessageCircle, UserRoundCheck } from "lucide-react";
import { AiAssistantSimulator } from "@/components/ai-assistant-simulator";
import { WhatsAppActivation } from "@/components/whatsapp-activation";
import { WhatsAppBotSimulator } from "@/components/whatsapp-bot-simulator";
import { Pagination } from "@/components/pagination";
import { getBrandConfig } from "@/lib/brand";
import { getServerEnv } from "@/lib/env";
import { createPageResult, normalizePageRequest, parsePage } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAiSpendSummary } from "@/services/messaging/ai-usage";
import { conversationViews, parseConversationFilters, whereConversationFilters, type ConversationFilters, type ConversationView } from "@/domain/messaging/conversation-filters";

const statusLabels: Record<string, string> = {
  open: "Nueva",
  bot_qualifying: "Calificando",
  qualified: "Lead creado",
  waiting_human: "Requiere atención",
  closed: "Cerrada",
};

function inboxHref(filters: ConversationFilters) {
  const params = new URLSearchParams({ ...(filters.view ? { view: filters.view } : {}), ...(filters.search ? { q: filters.search } : {}) });
  const query = params.toString();
  return `/admin/conversations${query ? `?${query}` : ""}#bandeja` as Route;
}

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const env = getServerEnv();
  const brand = getBrandConfig();
  const publicNumberReady = Boolean(env.NEXT_PUBLIC_WHATSAPP_NUMBER);
  const webhookReady = Boolean(env.WHATSAPP_VERIFY_TOKEN && env.WHATSAPP_APP_SECRET);
  const sendingReady = Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_GRAPH_VERSION);
  const configured = publicNumberReady && webhookReady && sendingReady;
  const botEnabled = env.WHATSAPP_BOT_ENABLED === "true";
  const aiEnabled = env.AI_PROVIDER === "anthropic" && Boolean(env.ANTHROPIC_API_KEY);
  let aiSpend: Awaited<ReturnType<typeof getAiSpendSummary>> | null = null;
  const params = await searchParams;
  const filters = parseConversationFilters(params);
  const requestedPage = parsePage(params.page);
  const viewCounts: Partial<Record<ConversationView, number>> = {};
  const pagination = normalizePageRequest({ page: requestedPage });
  let conversationPage = createPageResult([] as Array<{
    id: string;
    profileName: string;
    participant: string;
    status: string;
    lastMessageAt?: string;
    lastMessage?: string;
    handoff: boolean;
  }>, 0, pagination.page, pagination.pageSize);

  if (env.APP_MODE === "supabase") {
    const client = await createSupabaseServerClient();
    const { data, error, count } = await whereConversationFilters(
      client.from("conversations").select("id,profile_name,external_participant_id,status,last_message_at,human_handoff_requested,channels(type)", { count: "exact" }),
      filters,
    )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(pagination.from, pagination.to);
    if (error) throw new Error(`No fue posible cargar conversaciones: ${error.message}`);
    const rows = data ?? [];
    // Último mensaje con texto de cada conversación de la página (a lo más una página de consultas pequeñas).
    const [lastMessages] = await Promise.all([
      Promise.all(rows.map(async (row) => {
        const last = await client.from("messages").select("body").eq("conversation_id", row.id).not("body", "is", null)
          .order("sent_at", { ascending: false }).limit(1).maybeSingle();
        if (last.error) throw new Error(`No fue posible cargar el último mensaje: ${last.error.message}`);
        return last.data?.body ?? undefined;
      })),
      // Conteo por vista, respetando la búsqueda, para las pestañas de la bandeja.
      Promise.all((Object.keys(conversationViews) as ConversationView[]).map(async (view) => {
        const counted = await whereConversationFilters(client.from("conversations").select("id", { count: "exact", head: true }), { view, search: filters.search });
        if (counted.error) throw new Error(`No fue posible contar conversaciones: ${counted.error.message}`);
        viewCounts[view] = counted.count ?? 0;
      })),
    ]);
    if (aiEnabled) aiSpend = await getAiSpendSummary(client);
    conversationPage = createPageResult(rows.map((row, index) => ({
        id: row.id,
        profileName: row.profile_name ?? (row.channels?.type === "web" ? "Visitante del sitio" : row.channels?.type === "instagram" ? "Contacto Instagram" : "Contacto WhatsApp"),
        participant: row.channels?.type === "web" ? "Chat del sitio" : row.channels?.type === "instagram" ? "Instagram" : row.external_participant_id ?? "Sin identificador",
        status: row.status,
        lastMessageAt: row.last_message_at ?? undefined,
        lastMessage: lastMessages[index],
        handoff: row.human_handoff_requested,
      })), count ?? 0, pagination.page, pagination.pageSize);
  }
  const conversations = conversationPage.items;

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Conversaciones</h1>
          <p className="muted">WhatsApp y chat del sitio: atención con IA, registro de leads y derivación a una persona.</p>
        </div>
        <span className={`state ${configured ? "active" : "paused"}`}>● {configured ? "Canal configurado" : "Pendiente conectar Meta"}</span>
      </div>

      <section className="conversation-status-grid">
        <article className="card panel"><MessageCircle size={20}/><strong>Botón público</strong><span>{publicNumberReady ? "Listo" : "Modo preparación"}</span></article>
        <article className="card panel"><Bot size={20}/><strong>{aiEnabled ? "Asistente con IA" : "Bot de orientación"}</strong><span>{botEnabled ? "Activo" : "Apagado seguro"}{aiEnabled ? ` · ${env.AI_MODEL}` : ""}</span></article>
        <article className="card panel"><UserRoundCheck size={20}/><strong>Derivación humana</strong><span>Preparada</span></article>
      </section>

      <section className="card panel whatsapp-readiness" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div>
            <h2>Preparación para activar WhatsApp</h2>
            <p className="muted">El software queda listo ahora; el número y Meta se conectan después.</p>
          </div>
          <span className="state active">Código listo</span>
        </div>
        <div className="whatsapp-checklist">
          <div><CheckCircle2 size={18}/><span><strong>Webhook, firma y mensajes</strong><small>Implementados y probados</small></span></div>
          <div><CheckCircle2 size={18}/><span><strong>Calificación y consentimiento</strong><small>Implementados y probados</small></span></div>
          <div className={publicNumberReady ? "ready" : "pending"}>{publicNumberReady ? <CheckCircle2 size={18}/> : <CircleDashed size={18}/>}<span><strong>Número oficial</strong><small>{publicNumberReady ? "Configurado" : "Pendiente cuando esté disponible"}</small></span></div>
          <div className={webhookReady && sendingReady ? "ready" : "pending"}>{webhookReady && sendingReady ? <CheckCircle2 size={18}/> : <CircleDashed size={18}/>}<span><strong>Credenciales y suscripción de Meta</strong><small>{webhookReady && sendingReady ? "Configuradas" : "Pendientes junto con el número"}</small></span></div>
        </div>
        {sendingReady && <WhatsAppActivation />}
      </section>

      <section className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div>
            <h2><FlaskConical size={18}/> Laboratorio del {aiEnabled ? "asistente" : "bot"}</h2>
            <p className="muted">{aiEnabled ? "Conversa con el asistente real antes de abrirlo a clientes." : "Prueba el guion completo sin número, API ni datos reales."}</p>
          </div>
          <span className="state prospect">Sandbox</span>
        </div>
        {aiSpend && (
          <p className="muted" style={{ margin: "0 0 12px" }}>
            Gasto de IA: <strong>US${aiSpend.last24hUsd.toFixed(2)}</strong> últimas 24 h de US${env.AI_DAILY_BUDGET_USD.toFixed(2)} · <strong>US${aiSpend.monthToDateUsd.toFixed(2)}</strong> este mes · {aiSpend.repliesLast24h} respuestas en 24 h
          </p>
        )}
        {aiEnabled ? <AiAssistantSimulator /> : <WhatsAppBotSimulator brandName={brand.name} />}
      </section>

      <section className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head" id="bandeja"><h2>Bandeja de entrada</h2><span className="muted">{conversationPage.total} conversaciones{filters.view || filters.search ? " con filtros" : ""}</span></div>
        <form className="filter-bar filter-bar-inline" method="get" action="/admin/conversations#bandeja" role="search" aria-label="Filtrar conversaciones">
          {filters.view && <input type="hidden" name="view" value={filters.view}/>}
          <label className="filter-search"><span>Buscar</span><input type="search" name="q" defaultValue={filters.search} placeholder="Nombre o número"/></label>
          <div className="filter-actions"><button className="btn btn-primary btn-sm" type="submit">Buscar</button>{(filters.view || filters.search) && <Link className="btn btn-secondary btn-sm" href={inboxHref({})}>Limpiar</Link>}</div>
        </form>
        <nav className="segmented inbox-views" aria-label="Vistas de la bandeja">
          <Link href={inboxHref({ search: filters.search })} className={!filters.view ? "selected" : ""}>Todas</Link>
          {(Object.entries(conversationViews) as [ConversationView, string][]).map(([view, label]) => (
            <Link key={view} href={inboxHref({ view, search: filters.search })} className={filters.view === view ? "selected" : ""}>{label}{viewCounts[view] !== undefined ? ` (${viewCounts[view]})` : ""}</Link>
          ))}
        </nav>
        {conversations.length ? (
          <div className="conversation-list">
            {conversations.map((conversation) => (
              <Link className="conversation-row" href={`/admin/conversations/${conversation.id}`} key={conversation.id}>
                <span className="avatar">{conversation.profileName.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{conversation.profileName}</strong>
                  <p>{conversation.lastMessage ?? "Sin mensajes de texto"}</p>
                  <small>{conversation.participant}</small>
                </div>
                <div className="conversation-meta">
                  <span className={`state ${conversation.handoff ? "paused" : "active"}`}>{statusLabels[conversation.status] ?? conversation.status}</span>
                  {conversation.lastMessageAt && <time>{new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(conversation.lastMessageAt))}</time>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="success-box">
            <h2>La bandeja está lista</h2>
            <p className="muted">Las conversaciones aparecerán aquí cuando conectemos el número oficial y Meta entregue el primer mensaje.</p>
          </div>
        )}
        <Pagination path="/admin/conversations" page={conversationPage.page} totalPages={conversationPage.totalPages} total={conversationPage.total} params={{ ...(filters.view ? { view: filters.view } : {}), ...(filters.search ? { q: filters.search } : {}) }}/>
      </section>
    </>
  );
}
