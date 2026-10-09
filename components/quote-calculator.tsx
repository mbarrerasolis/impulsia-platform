"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, CheckCircle2, LoaderCircle } from "lucide-react";
import type { SolutionCatalogItem } from "@/domain/config/edition";
import type { QuotePrefill } from "@/domain/pricing/quote-prefill";
import { calculateExpansionQuote } from "@/domain/pricing/engine";
import type { ComplexityKey, PricingRules } from "@/domain/pricing/types";
import { formatMoney } from "@/lib/format";

interface AccountOption { id:string; name:string; activeSolutions:number }
const complexityLabels:Record<ComplexityKey,string>={standard:"Estándar",medium:"Media",high:"Alta",research:"Investigación",advanced_research:"Investigación avanzada"};

export function QuoteCalculator({accounts,pricingRules,catalog,locale,initial}:{accounts:AccountOption[];pricingRules:PricingRules;catalog:SolutionCatalogItem[];locale:string;initial?:QuotePrefill&{accountId?:string}}){
  const router=useRouter();
  // Con prellenado (propuesta del asistente) se parte de una solución personalizada en vez de la primera plantilla.
  const initialCatalogItem=initial?undefined:catalog[0];
  const [accountId,setAccountId]=useState(initial?.accountId??accounts[0]?.id??"");
  const [catalogKey,setCatalogKey]=useState(initialCatalogItem?.key??"custom");
  const [name,setName]=useState(initial?.name??initialCatalogItem?.name??"Automatización de proceso");
  const [days,setDays]=useState(initial?.estimatedDays??initialCatalogItem?.defaultDays??3);
  const [complexity,setComplexity]=useState<ComplexityKey>(initial?.complexity??initialCatalogItem?.defaultComplexity??"medium");
  const [thirdParty,setThirdParty]=useState(initial?.thirdPartyMonthlyCost??0);
  const [notes,setNotes]=useState(initial?.notes??"");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const selected=accounts.find(account=>account.id===accountId);
  const active=selected?.activeSolutions??0;
  const quote=useMemo(()=>calculateExpansionQuote({
    estimatedDays:days,complexity,activeSolutionsBeforeAddition:active,
    thirdPartyCosts:thirdParty>0?[{provider:"Proveedor por confirmar",description:"Costo externo mensual",cost:thirdParty,currency:pricingRules.currency,periodicity:"monthly",paidBy:"rebilled"}]:[]
  },pricingRules),[days,complexity,active,thirdParty,pricingRules]);

  function selectCatalogItem(key:string){
    setCatalogKey(key);
    const item=catalog.find(candidate=>candidate.key===key);
    if(!item)return;
    setName(item.name);setDays(item.defaultDays);setComplexity(item.defaultComplexity);
  }

  async function save(){
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/admin/quotes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({accountId,name,estimatedDays:days,complexity,thirdPartyMonthlyCost:thirdParty,estimationNotes:notes||undefined})});
      const result=await response.json() as {error?:string;quote?:{id:string}};
      if(!response.ok||!result.quote)throw new Error(result.error??"No fue posible guardar la cotización.");
      router.push(`/admin/quotes/${result.quote.id}`);
    }catch(cause){setError(cause instanceof Error?cause.message:"Error inesperado.");setLoading(false);}
  }

  return <div className="quote-layout">
    <section className="card quote-form">
      <div className="panel-head"><div><span className="eyebrow"><Calculator size={13}/> Motor {pricingRules.version}</span><h2 style={{marginTop:16}}>Configurar solución</h2></div></div>
      <div className="field"><label htmlFor="catalog-item">Plantilla de catálogo</label><select id="catalog-item" value={catalogKey} onChange={event=>selectCatalogItem(event.target.value)}>{catalog.map(item=><option value={item.key} key={item.key}>{item.category} · {item.name}</option>)}<option value="custom">Solución personalizada</option></select><span className="field-hint">La plantilla propone nombre, jornadas y complejidad; puedes ajustar todo antes de guardar.</span></div>
      <div className="field"><label htmlFor="solution-name">Nombre de la solución</label><input id="solution-name" value={name} onChange={event=>setName(event.target.value)}/></div>
      <div className="field"><label htmlFor="account">Cuenta</label><select id="account" value={accountId} onChange={event=>setAccountId(event.target.value)}>{accounts.map(account=><option value={account.id} key={account.id}>{account.name}</option>)}</select></div>
      <div className="field-grid"><div className="field"><label htmlFor="days">Jornadas estimadas</label><input id="days" type="number" min="0.25" step="0.25" value={days} onChange={event=>setDays(Math.max(.25,Number(event.target.value)))}/></div><div className="field"><label htmlFor="complexity">Complejidad</label><select id="complexity" value={complexity} onChange={event=>setComplexity(event.target.value as ComplexityKey)}>{Object.entries(complexityLabels).map(([key,label])=><option value={key} key={key}>{label} · {pricingRules.complexityFactors[key as ComplexityKey].toLocaleString(locale)}×</option>)}</select></div></div>
      <div className="field-grid"><div className="field"><label htmlFor="active">Soluciones activas actuales</label><input id="active" readOnly value={active}/><span className="field-hint">Dato del servidor; determina el nivel de expansión.</span></div><div className="field"><label htmlFor="thirdParty">Costo externo mensual</label><input id="thirdParty" type="number" min="0" step={pricingRules.roundingMultiple} value={thirdParty} onChange={event=>setThirdParty(Math.max(0,Number(event.target.value)))}/></div></div>
      <div className="field"><label htmlFor="notes">Notas de estimación</label><textarea id="notes" value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Supuestos, alcance y dependencias técnicas..."/></div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary" style={{width:"100%"}} onClick={save} disabled={loading||!accountId||name.length<3}>{loading&&<LoaderCircle size={17}/>}Guardar cotización</button>
      <p className="field-hint" style={{marginTop:12}}>El servidor recalcula todos los montos con el estado real de la cuenta antes de guardar.</p>
    </section>
    <aside className="card quote-result"><span className="ops-label">Resultado de cotización · {pricingRules.currency}</span><p className="muted" style={{marginTop:28}}>Implementación neta</p><div className="quote-total">{formatMoney(quote.netImplementation,pricingRules.currency,locale)}</div><p className="quote-discount"><strong>{quote.expansionDiscountPercent}% beneficio</strong> por ser la solución N° {quote.activeSolutionsAfterAddition}</p><div style={{marginTop:25}}><div className="quote-line"><span>Precio base</span><strong>{formatMoney(quote.grossImplementation,pricingRules.currency,locale)}</strong></div><div className="quote-line"><span>{quote.estimatedDays} jornadas × {formatMoney(quote.dayRate,pricingRules.currency,locale)} × {quote.complexityFactor}</span><strong>{formatMoney(quote.grossImplementation,pricingRules.currency,locale)}</strong></div><div className="quote-line"><span>Mantención base</span><strong>{formatMoney(quote.grossMaintenanceIncrement,pricingRules.currency,locale)} / mes</strong></div><div className="quote-line"><span>Mantención con beneficio</span><strong className="quote-discount">{formatMoney(quote.netMaintenanceIncrement,pricingRules.currency,locale)} / mes</strong></div>{thirdParty>0&&<div className="quote-line"><span>Costo externo (sin descuento)</span><strong>{formatMoney(thirdParty,pricingRules.currency,locale)} / mes</strong></div>}</div><div style={{display:"flex",gap:9,alignItems:"flex-start",marginTop:26,padding:15,borderRadius:10,background:"rgba(255,255,255,.07)",fontSize:12,lineHeight:1.5}}><CheckCircle2 size={17} style={{flex:"0 0 auto",color:"var(--lime)"}}/><span>Se guardarán moneda, jornadas, factor, tarifa, descuentos y reglas completas como snapshot histórico.</span></div></aside>
  </div>;
}
