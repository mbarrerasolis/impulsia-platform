"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { readAttribution } from "@/lib/marketing/browser";

interface ChatMessage { id: string; direction: "inbound" | "outbound"; body: string; sentAt: string; fromTeam?: boolean }

const visitorKey = "store-chat-visitor";
const pollMs = 8_000;

function visitorId() {
  try {
    const saved = window.localStorage.getItem(visitorKey);
    if (saved) return saved;
    const created = crypto.randomUUID();
    window.localStorage.setItem(visitorKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

/** Enlaces clicables y *negritas* de WhatsApp; el resto es texto plano. */
function renderBody(text: string): ReactNode {
  return text.split(/(https?:\/\/[^\s)]+|\*[^*\n]+\*)/g).map((part, index) => {
    if (/^https?:\/\//.test(part)) return <a key={index} href={part} target={part.includes(window.location.host) ? undefined : "_blank"} rel="noreferrer">{part.replace(/^https?:\/\/[^/]+/, "") || part}</a>;
    if (/^\*[^*]+\*$/.test(part)) return <b key={index}>{part.slice(1, -1)}</b>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Chat del sitio con el asistente de la tienda; si una persona toma la conversación, aquí llegan sus respuestas. */
export function StoreChat({ assistantName, brandName, suggestions }: { assistantName?: string; brandName: string; suggestions: string[] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [waitingHuman, setWaitingHuman] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const title = assistantName ?? "Vendedor virtual";

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat?visitorId=${visitorId()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { messages: ChatMessage[]; waitingHuman: boolean };
      setMessages(data.messages);
      setWaitingHuman(data.waitingHuman);
    } catch { /* sin conexión: se reintenta en el próximo ciclo */ } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga el historial al abrir el chat
    void refresh();
    inputRef.current?.focus();
    if (!waitingHuman) return;
    const timer = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(timer);
  }, [open, waitingHuman, refresh]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages, sending, open]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setDraft(""); setError(""); setSending(true);
    setMessages((current) => [...current, { id: `local-${Date.now()}`, direction: "inbound", body: message, sentAt: new Date().toISOString() }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitorId: visitorId(), message, page: window.location.pathname, attribution: readAttribution(), website: "" }),
      });
      const data = await response.json() as { reply?: string | null; waitingHuman?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No pude responder ahora.");
      if (data.reply) setMessages((current) => [...current, { id: `reply-${Date.now()}`, direction: "outbound", body: data.reply!, sentAt: new Date().toISOString() }]);
      setWaitingHuman(Boolean(data.waitingHuman));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude responder ahora.");
    } finally {
      setSending(false);
    }
  }

  const onSubmit = (event: FormEvent) => { event.preventDefault(); void send(draft); };

  return <>
    {!open && <button type="button" className="st-chat-fab" onClick={() => setOpen(true)} aria-label={`Abrir chat con ${title}`}>
      <MessageCircle size={20} aria-hidden="true" /> <span>{assistantName ? `Pregúntale a ${assistantName}` : "¿Te ayudo con tu compra?"}</span>
    </button>}
    {open && <section className="st-chat" role="dialog" aria-label={`Chat con ${title}`}>
      <header>
        <div><b>{title}</b><small>{waitingHuman ? "Te atiende una persona del equipo" : `${brandName} · te ayuda a elegir, cotizar y armar tu pedido`}</small></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat"><X size={18} /></button>
      </header>
      <div className="st-chat-list" ref={listRef} aria-live="polite">
        {loaded && messages.length === 0 && <div className="st-chat-empty">
          <p>Cuéntanos qué productos necesitas y te ayudamos con precios, stock, despacho y tu pedido.</p>
          <div className="st-chat-chips">{suggestions.map((item) => <button key={item} type="button" onClick={() => void send(item)}>{item}</button>)}</div>
        </div>}
        {messages.map((message) => <p key={message.id} className={`st-chat-msg ${message.direction === "inbound" ? "is-me" : "is-them"}`}>
          {message.fromTeam && <small>Equipo {brandName}</small>}
          {renderBody(message.body)}
        </p>)}
        {sending && <p className="st-chat-msg is-them st-chat-typing" aria-label="Escribiendo"><span /><span /><span /></p>}
      </div>
      {error && <p className="st-chat-error" role="alert">{error}</p>}
      <form className="st-chat-form" onSubmit={onSubmit}>
        <label htmlFor="st-chat-input" className="sr-only">Escribe tu mensaje</label>
        <textarea id="st-chat-input" ref={inputRef} rows={1} value={draft} maxLength={1500} placeholder="Escribe tu mensaje…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(draft); } }} />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar"><Send size={18} /></button>
      </form>
      <p className="st-chat-note">Las respuestas las genera una IA y pueden tener errores; el equipo confirma precio, stock y despacho antes de cobrar.</p>
    </section>}
  </>;
}
