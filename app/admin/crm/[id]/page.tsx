import { LeadOriginTag } from "@/components/lead-origin-tag";
import { notFound } from "next/navigation";
import { Building2, Mail, Megaphone, MessageCircle, ShoppingBag, Workflow } from "lucide-react";
import { ConvertLeadButton } from "@/components/convert-lead-button";
import { LeadTemperaturePicker } from "@/components/lead-temperature-picker";
import { leadTemperature, temperatureLabels } from "@/domain/crm/lead-temperature";
import { whatsappLink } from "@/domain/crm/phone";
import { attributionLabel } from "@/domain/marketing/attribution";
import { getBusinessProfile } from "@/lib/business";
import { getLeadRepository } from "@/repositories";
import { formatDate } from "@/lib/format";

const row = { gridTemplateColumns: "32px 1fr" } as const;

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadRepository().find(id);
  if (!lead) notFound();
  const temperature = leadTemperature(lead);
  // Ediciones que sólo venden productos: el lead es un pedido (persona o negocio), no un diagnóstico de procesos.
  const store = getBusinessProfile().offering === "products";
  const person = lead.company === "Particular";
  const whatsapp = whatsappLink(lead.phone);

  return <>
    <div className="admin-title">
      <div>
        <h1>{store && person ? lead.name : lead.company}</h1>
        <p className="muted">{store ? `${lead.primaryGoal} · recibido el` : "Diagnóstico recibido el"} {formatDate(lead.createdAt)} · Score {lead.score}/100</p>
      </div>
      <span className={`temp-pill temp-${temperature}`}><span className="temp-dot" aria-hidden />{temperatureLabels[temperature]}</span>
    </div>
    <section className="admin-grid">
      <article className="card panel">
        <h2>{store ? <><ShoppingBag size={17} style={{ verticalAlign: "-3px", marginRight: 6 }} />Pedido</> : "Necesidad detectada"}</h2>
        <p style={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>{lead.rawNeedDescription}</p>
        {!store && <>
          <div className="pipeline-row" style={row}><Workflow size={17} /><span><strong>Sistemas</strong><br /><span className="muted">{lead.systems.join(", ") || "No informados"}</span></span></div>
          <div className="pipeline-row" style={row}><Building2 size={17} /><span><strong>Impacto</strong><br /><span className="muted">{lead.peopleInvolved ?? "—"} personas · {lead.hoursPerMonth ?? "—"} horas/mes · {lead.monthlyVolume ?? "—"} casos</span></span></div>
        </>}
        <div className="pipeline-row" style={row}><Megaphone size={17} /><span><strong>Procedencia</strong> <LeadOriginTag lead={lead} /><br /><span className="muted">{attributionLabel(lead.attribution)}{lead.attribution?.utmContent && ` · ${lead.attribution.utmContent}`}{lead.attribution?.landingPath && ` · entró por ${lead.attribution.landingPath}`}</span></span></div>
      </article>
      <aside className="card panel">
        <h2>Temperatura</h2>
        {temperature === "closed" ? <p className="muted">Lead cerrado ({lead.status === "converted" ? "convertido" : "perdido"}).</p> : <LeadTemperaturePicker leadId={lead.id} current={temperature} />}
        <h2>Contacto{store ? "" : " y conversión"}</h2>
        <p>
          <strong>{lead.name}</strong>{store && !person && <><br /><span className="muted">{lead.company}</span></>}
          {lead.email && <><br /><a className="muted" href={`mailto:${lead.email}`}><Mail size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />{lead.email}</a></>}
          {lead.phone && <><br /><span className="muted">{lead.phone}</span></>}
        </p>
        {whatsapp && <a className="btn btn-primary btn-sm" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Escribir por WhatsApp</a>}
        {!store && <ConvertLeadButton leadId={lead.id} convertedAccountId={lead.convertedAccountId} />}
      </aside>
    </section>
  </>;
}
