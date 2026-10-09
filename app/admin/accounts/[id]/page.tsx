import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { ContactsPanel } from "@/components/contacts-panel";
import { demoStore } from "@/repositories/memory/demo-store";
import { getReadModelRepository } from "@/repositories";
import { getServerEnv } from "@/lib/env";
import { formatClp } from "@/lib/format";

export default async function AccountPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const mode=getServerEnv().APP_MODE;const repository=getReadModelRepository();const account=await repository.findAccount(id);if(!account)notFound();
  const contacts=await repository.listContacts(id);
  const audit=mode==="demo"?demoStore.auditLog.filter(event=>event.accountId===id).slice(-5).reverse():[];
  const nextDiscount = account.activeSolutions === 0 ? 0 : account.activeSolutions === 1 ? 25 : account.activeSolutions === 2 ? 30 : account.activeSolutions === 3 ? 35 : 40;
  return <><div className="card account-header"><div className="account-name"><span className="avatar"><Building2 size={21}/></span><div><h1 style={{margin:0,fontSize:25}}>{account.tradeName}</h1><span className="muted">{account.legalName} · {account.industry}</span></div></div><span className={`state ${account.status}`}>● {account.status}</span></div><section className="stat-grid"><article className="card stat"><div className="stat-top">MRR</div><div className="stat-value">{formatClp(account.mrr)}</div></article><article className="card stat"><div className="stat-top">Soluciones activas</div><div className="stat-value">{account.activeSolutions}</div></article><article className="card stat"><div className="stat-top">Próxima expansión</div><div className="stat-value">{nextDiscount}%</div><div className="stat-change">beneficio aplicable</div></article><article className="card stat"><div className="stat-top">Deuda vencida</div><div className="stat-value">{formatClp(0)}</div></article></section><section className="admin-grid"><ContactsPanel accountId={account.id} contacts={contacts} editable={mode==="supabase"}/><article className="card panel"><h2>Próxima acción</h2><p style={{lineHeight:1.6}}>Revisar oportunidades de integración y confirmar el proceso prioritario con el contacto comercial.</p><button className="btn btn-primary">Crear oportunidad</button></article></section>{audit.length>0&&<section className="card panel" style={{marginTop:16}}><div className="panel-head"><h2>Auditoría reciente</h2><span className="muted" style={{fontSize:12}}>Sólo roles autorizados en producción</span></div>{audit.map(event=><div className="pipeline-row" style={{gridTemplateColumns:"1fr auto auto"}} key={event.id}><strong>{event.action}</strong><span>{event.entityType}</span><span className="muted">{new Date(event.createdAt).toLocaleString("es-CL")}</span></div>)}</section>}</>;
}
