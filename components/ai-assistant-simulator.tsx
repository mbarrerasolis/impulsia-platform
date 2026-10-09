"use client";

import { FormEvent, useState } from "react";
import { RotateCcw, Send } from "lucide-react";

interface SimulatorMessage {
  id: number;
  direction: "inbound" | "outbound";
  body: string;
}

interface PreviewLead {
  name: string;
  company: string;
  email: string;
  need: string;
}

interface PreviewQuoteProposal {
  name: string;
  scope: string;
  estimatedDays: number;
  complexity: string;
  implementationEstimate: number;
  monthlyMaintenanceEstimate: number;
}

interface PreviewResponse {
  reply?: string;
  lead?: PreviewLead | null;
  handoff?: { reason: string; priority: "normal" | "alta" } | null;
  quoteProposal?: PreviewQuoteProposal | null;
  meeting?: { start: string; topic: string } | null;
  costUsd?: number;
  error?: string;
}

export function AiAssistantSimulator() {
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [lead, setLead] = useState<PreviewLead>();
  const [handoff, setHandoff] = useState<PreviewResponse["handoff"]>(null);
  const [quoteProposal, setQuoteProposal] = useState<PreviewQuoteProposal>();
  const [meeting, setMeeting] = useState<PreviewResponse["meeting"]>(null);
  const [costUsd, setCostUsd] = useState(0);

  function reset() {
    setMessages([]);
    setDraft("");
    setError(undefined);
    setLead(undefined);
    setHandoff(null);
    setQuoteProposal(undefined);
    setMeeting(null);
    setCostUsd(0);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || pending || handoff) return;

    const history = messages.map(({ direction, body: text }) => ({ direction, body: text }));
    const inbound: SimulatorMessage = { id: messages.length + 1, direction: "inbound", body };
    setMessages((current) => [...current, inbound]);
    setDraft("");
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/admin/assistant/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history, message: body, leadRegistered: Boolean(lead), quoteProposalsSent: quoteProposal ? 1 : 0, meetingsScheduled: meeting ? 1 : 0 }),
      });
      const data = await response.json() as PreviewResponse;
      if (!response.ok || !data.reply) throw new Error(data.error ?? "No fue posible obtener respuesta.");
      setMessages((current) => [...current, { id: current.length + 1, direction: "outbound", body: data.reply! }]);
      if (data.lead) setLead(data.lead);
      if (data.handoff) setHandoff(data.handoff);
      if (data.quoteProposal) setQuoteProposal(data.quoteProposal);
      if (data.meeting) setMeeting(data.meeting);
      setCostUsd((total) => total + (data.costUsd ?? 0));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No fue posible obtener respuesta.");
      // Se quita el mensaje sin respuesta para que el historial siga siendo consistente.
      setMessages((current) => current.filter((message) => message.id !== inbound.id));
      setDraft(body);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bot-simulator">
      <div className="bot-simulator-toolbar">
        <div>
          <strong>Asistente con IA · modelo real</strong>
          <span>No envía WhatsApp ni crea leads. Costo de esta prueba: US${costUsd.toFixed(4)}</span>
        </div>
        <button className="session-button" type="button" onClick={reset} disabled={pending}>
          <RotateCcw size={14} /> Reiniciar
        </button>
      </div>

      <div className="bot-chat" aria-live="polite">
        {messages.map((message) => (
          <p className={`bot-message ${message.direction}`} key={message.id}>
            {message.body}
          </p>
        ))}
        {pending && <p className="bot-message outbound">Escribiendo…</p>}
      </div>

      {lead && (
        <div className="bot-lead-preview">
          <strong>Lead que se registraría</strong>
          <span>{lead.name} · {lead.company} · {lead.email}</span>
          <span>{lead.need}</span>
        </div>
      )}

      {quoteProposal && (
        <div className="bot-lead-preview">
          <strong>Propuesta de cotización que llegaría al equipo</strong>
          <span>{quoteProposal.name} · {quoteProposal.estimatedDays} jornadas · complejidad {quoteProposal.complexity}</span>
          <span>{quoteProposal.scope}</span>
        </div>
      )}

      {meeting && (
        <div className="bot-lead-preview">
          <strong>Reunión que se agendaría (en la prueba no se crea)</strong>
          <span>{new Date(meeting.start).toLocaleString("es-CL", { timeZone: "America/Santiago", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} · {meeting.topic}</span>
        </div>
      )}

      {error && <p className="bot-simulator-result" role="alert">{error}</p>}

      {handoff ? (
        <div className="bot-simulator-result">
          Derivada a una persona{handoff.priority === "alta" ? " (prioridad alta)" : ""}: <strong>{handoff.reason}</strong>
        </div>
      ) : (
        <form className="bot-composer" onSubmit={sendMessage}>
          <label className="sr-only" htmlFor="ai-simulator-message">Mensaje de prueba</label>
          <input
            id="ai-simulator-message"
            value={draft}
            maxLength={1500}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribe como si fueras un cliente"
            disabled={pending}
          />
          <button className="btn btn-primary" type="submit" disabled={!draft.trim() || pending}>
            <Send size={16} /> Enviar
          </button>
        </form>
      )}
    </div>
  );
}
