import Link from "next/link";
import { QuoteCalculator } from "@/components/quote-calculator";
import { parseQuotePrefill } from "@/domain/pricing/quote-prefill";
import { getEditionConfig } from "@/lib/edition";
import { getLeadRepository, getReadModelRepository } from "@/repositories";

export default async function NewQuotePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const edition=getEditionConfig();
  const source=await getReadModelRepository().listAccounts();
  const accounts=source.filter(account=>!["churned","paused"].includes(account.status)).map(account=>({id:account.id,name:account.tradeName,activeSolutions:account.activeSolutions}));
  const prefill=parseQuotePrefill(await searchParams);
  // La propuesta del asistente trae el lead: si ya es cuenta, se preselecciona; si no, se avisa que falta convertirlo.
  const lead=prefill?.leadId?await getLeadRepository().find(prefill.leadId):undefined;
  const leadAccountId=lead?.convertedAccountId&&accounts.some(account=>account.id===lead.convertedAccountId)?lead.convertedAccountId:undefined;
  return <><div className="admin-title"><div><h1>Nueva cotización</h1><p className="muted">{prefill?"Propuesta del asistente de WhatsApp: revisa y ajusta antes de guardar.":"Calcula implementación y mantención con reglas versionadas."}</p></div></div>
    {lead&&!leadAccountId&&<p className="card" style={{padding:16,marginBottom:18}}>El lead <strong>{lead.company}</strong> aún no es una cuenta. <Link href={`/admin/crm/${lead.id}`}>Conviértelo primero</Link> y vuelve a abrir el enlace del correo para que quede seleccionado.</p>}
    <QuoteCalculator accounts={accounts} pricingRules={edition.pricing} catalog={edition.catalog} locale={edition.locale} initial={prefill?{...prefill,accountId:leadAccountId}:undefined}/></>;
}
