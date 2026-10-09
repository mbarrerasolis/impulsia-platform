"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

interface ProfileOption {
  id: string;
  displayName: string;
}

interface ConversationMessage {
  id: string;
  direction: string;
  body: string | null;
  sentAt: string;
  deliveryStatus: string | null;
  deliveryError?: string;
  /** Adjunto que mandó el cliente; el panel lo trae desde Meta al abrirlo. */
  media?: { kind: "image" | "document" | "audio" | "video" | "sticker"; filename?: string };
  /** La respuesta salió como nota de voz. */
  voiceReply?: boolean;
}

export function ConversationWorkspace(props: {
  conversationId: string;
  assignedTo: string | null;
  status: string;
  messages: ConversationMessage[];
  profiles: ProfileOption[];
  sendingEnabled: boolean;
  /** Por dónde sale la respuesta ("WhatsApp" o "el chat del sitio"). */
  channelLabel?: string;
}) {
  const router = useRouter();
  const [assignedTo, setAssignedTo] = useState(props.assignedTo ?? "");
  const [status, setStatus] = useState(props.status === "closed" ? "closed" : props.status === "waiting_human" ? "waiting_human" : "bot_qualifying");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  async function saveConversation() {
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/conversations/${props.conversationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignedTo: assignedTo || null, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No fue posible guardar los cambios.");
      setNotice("Conversación actualizada.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible guardar los cambios.");
    } finally {
      setPending(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || !props.sendingEnabled) return;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/conversations/${props.conversationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No fue posible enviar el mensaje.");
      setBody("");
      setNotice("Mensaje enviado.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible enviar el mensaje.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="conversation-workspace">
      <section className="card panel conversation-thread">
        <div className="panel-head"><h2>Historial</h2><span className="muted">{props.messages.length} mensajes</span></div>
        <div className="operator-chat">
          {props.messages.length ? props.messages.map((message) => (
            <article className={`operator-message ${message.direction}`} key={message.id}>
              {message.media && <MessageMedia conversationId={props.conversationId} messageId={message.id} media={message.media}/>}
              <p>{message.body ?? "Mensaje sin texto"}</p>
              {message.voiceReply && <small>Enviada como nota de voz</small>}
              <small>{new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.sentAt))}{message.deliveryStatus ? ` · ${message.deliveryStatus}` : ""}</small>
              {message.deliveryError && <small className="delivery-error" role="alert">No entregado · {message.deliveryError}</small>}
            </article>
          )) : <p className="muted">Todavía no hay mensajes en esta conversación.</p>}
        </div>
        <form className="operator-composer" onSubmit={sendReply}>
          <label htmlFor="operator-reply">Respuesta</label>
          <textarea id="operator-reply" value={body} onChange={(event) => setBody(event.target.value)} disabled={!props.sendingEnabled || pending} placeholder={props.sendingEnabled ? "Escribe una respuesta" : "Se habilitará al conectar el número y la API de Meta"}/>
          <button className="btn btn-primary" type="submit" disabled={!props.sendingEnabled || !body.trim() || pending}><Send size={16}/> Enviar por {props.channelLabel ?? "WhatsApp"}</button>
          {!props.sendingEnabled && <small className="muted">La respuesta ya está programada; sólo falta conectar Meta.</small>}
        </form>
      </section>

      <aside className="card panel conversation-controls">
        <h2>Atención humana</h2>
        <label htmlFor="conversation-assignee">Responsable</label>
        <select id="conversation-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
          <option value="">Sin asignar</option>
          {props.profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.displayName}</option>)}
        </select>
        <label htmlFor="conversation-status">Estado</label>
        <select id="conversation-status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="waiting_human">En atención</option>
          <option value="bot_qualifying">Atiende Claudia (asistente)</option>
          <option value="closed">Cerrada</option>
        </select>
        <button className="btn btn-secondary" type="button" onClick={saveConversation} disabled={pending}>Guardar cambios</button>
        {notice && <p className="field-hint" aria-live="polite">{notice}</p>}
      </aside>
    </div>
  );
}

function MessageMedia({ conversationId, messageId, media }: { conversationId: string; messageId: string; media: NonNullable<ConversationMessage["media"]> }) {
  const src = `/api/admin/conversations/${conversationId}/media/${messageId}`;
  if (media.kind === "image" || media.kind === "sticker") {
    // eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por el panel, no pasa por el optimizador.
    return <a href={src} target="_blank" rel="noreferrer"><img className="operator-media" src={src} alt="Imagen enviada por el cliente" loading="lazy"/></a>;
  }
  if (media.kind === "audio") return <audio className="operator-media" controls preload="none" src={src}/>;
  return <a className="operator-media-link" href={src} target="_blank" rel="noreferrer">Abrir {media.kind === "video" ? "video" : media.filename ?? "documento"}</a>;
}
