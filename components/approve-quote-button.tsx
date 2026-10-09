"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";

export function ApproveQuoteButton({quoteId,status}:{quoteId:string;status:string}){
  const router=useRouter();
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  if(status==="approved")return <span className="state active"><CheckCircle2 size={13}/> Cotización aprobada</span>;
  async function approve(){setLoading(true);setError("");try{const response=await fetch(`/api/admin/quotes/${quoteId}/approve`,{method:"POST"});const result=await response.json() as {error?:string;result?:{billingPeriod:{id:string}}};if(!response.ok||!result.result)throw new Error(result.error??"No fue posible aprobar.");router.push(`/admin/billing?period=${result.result.billingPeriod.id}`);}catch(cause){setError(cause instanceof Error?cause.message:"Error inesperado.");setLoading(false);}}
  return <div>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" onClick={approve} disabled={loading}>{loading&&<LoaderCircle size={16}/>}Aprobar y activar solución</button></div>;
}
