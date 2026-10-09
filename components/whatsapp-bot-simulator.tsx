"use client";

import { FormEvent, useMemo, useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import {
  advanceLeadQualification,
  type QualificationContext,
  type QualificationState,
  type QualifiedWhatsAppLead,
} from "@/domain/messaging/lead-qualification-bot";

interface SimulatorMessage {
  id: number;
  direction: "inbound" | "outbound";
  body: string;
}

const demoReplies: Partial<Record<QualificationState, string>> = {
  awaiting_need: "Quiero automatizar la respuesta y calificación de nuevos clientes",
  awaiting_company: "Empresa Demo",
  awaiting_email: "demo@empresa.cl",
  awaiting_goal: "Responder más rápido y vender más",
  awaiting_consent: "SÍ",
};

function createSession(brandName: string) {
  const greeting = advanceLeadQualification({
    state: "new",
    context: {},
    message: "Hola",
    profileName: "Lead de prueba",
    phone: "56900000000",
    brandName,
  });

  return {
    state: greeting.state,
    context: greeting.context,
    messages: greeting.reply
      ? [{ id: 1, direction: "outbound" as const, body: greeting.reply }]
      : [],
  };
}

export function WhatsAppBotSimulator({ brandName }: { brandName: string }) {
  const initial = useMemo(() => createSession(brandName), [brandName]);
  const [state, setState] = useState<QualificationState>(initial.state);
  const [context, setContext] = useState<QualificationContext>(initial.context);
  const [messages, setMessages] = useState<SimulatorMessage[]>(initial.messages);
  const [draft, setDraft] = useState("");
  const [lead, setLead] = useState<QualifiedWhatsAppLead>();

  const finished = state === "qualified" || state === "waiting_human" || state === "closed";

  function reset() {
    const session = createSession(brandName);
    setState(session.state);
    setContext(session.context);
    setMessages(session.messages);
    setDraft("");
    setLead(undefined);
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || finished) return;

    const result = advanceLeadQualification({
      state,
      context,
      message: body,
      profileName: "Lead de prueba",
      phone: "56900000000",
      brandName,
    });
    const nextId = messages.length + 1;
    setMessages((current) => [
      ...current,
      { id: nextId, direction: "inbound", body },
      ...(result.reply ? [{ id: nextId + 1, direction: "outbound" as const, body: result.reply }] : []),
    ]);
    setState(result.state);
    setContext(result.context);
    setLead(result.lead);
    setDraft("");
  }

  return (
    <div className="bot-simulator">
      <div className="bot-simulator-toolbar">
        <div>
          <strong>Simulación local</strong>
          <span>No envía mensajes ni guarda datos.</span>
        </div>
        <button className="session-button" type="button" onClick={reset}>
          <RotateCcw size={14} /> Reiniciar
        </button>
      </div>

      <div className="bot-chat" aria-live="polite">
        {messages.map((message) => (
          <p className={`bot-message ${message.direction}`} key={message.id}>
            {message.body}
          </p>
        ))}
      </div>

      {lead && (
        <div className="bot-lead-preview">
          <strong>Lead que se crearía</strong>
          <span>{lead.company} · {lead.email}</span>
          <span>{lead.rawNeedDescription}</span>
        </div>
      )}

      {finished ? (
        <div className="bot-simulator-result">
          Estado final: <strong>{state === "qualified" ? "lead calificado" : state === "waiting_human" ? "derivación humana" : "cerrado sin consentimiento"}</strong>
        </div>
      ) : (
        <form className="bot-composer" onSubmit={sendMessage}>
          <label className="sr-only" htmlFor="bot-simulator-message">Mensaje de prueba</label>
          <input
            id="bot-simulator-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribe como si fueras un lead"
          />
          <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>
            <Send size={16} /> Enviar
          </button>
          {demoReplies[state] && (
            <button className="bot-demo-reply" type="button" onClick={() => setDraft(demoReplies[state] ?? "")}>
              Usar respuesta de prueba
            </button>
          )}
        </form>
      )}
    </div>
  );
}
