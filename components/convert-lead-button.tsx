"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function ConvertLeadButton({leadId,convertedAccountId}:{leadId:string;convertedAccountId?:string}){
  const router=useRouter();
  const [industry,setIndustry]=useState("Servicios"); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  if(convertedAccountId) return <button className="btn btn-secondary" onClick={()=>router.push(`/admin/accounts/${convertedAccountId}`)}>Abrir cuenta <ArrowRight size={16}/></button>;
  async function convert(){setLoading(true);setError("");try{const response=await fetch(`/api/admin/leads/${leadId}/convert`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({industry})});const result=await response.json() as {error?:string;account?:{id:string}};if(!response.ok||!result.account)throw new Error(result.error??"No fue posible convertir el lead.");router.push(`/admin/accounts/${result.account.id}`);}catch(cause){setError(cause instanceof Error?cause.message:"Error inesperado.");setLoading(false);}}
  return <div><div className="field"><label htmlFor="industry">Industria de la nueva cuenta</label><input id="industry" value={industry} onChange={event=>setIndustry(event.target.value)}/></div>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" onClick={convert} disabled={loading}>{loading&&<LoaderCircle size={16}/>}Convertir en cliente <ArrowRight size={16}/></button></div>;
}
