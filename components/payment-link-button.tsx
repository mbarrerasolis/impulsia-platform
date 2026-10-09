"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";

export function PaymentLinkButton({periodId,status,enabled=true}:{periodId:string;status:string;enabled?:boolean}){
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  if(status==="paid")return <span className="state active">● Pagado</span>;
  if(!enabled)return <span className="state">Proveedor pendiente</span>;
  async function create(){setLoading(true);setError("");try{const response=await fetch(`/api/admin/billing/${periodId}/payment-link`,{method:"POST"});const result=await response.json() as {error?:string;url?:string};if(!response.ok||!result.url)throw new Error(result.error??"No fue posible crear el link.");window.location.assign(result.url);}catch(cause){setError(cause instanceof Error?cause.message:"Error inesperado.");setLoading(false);}}
  return <div>{error&&<span className="form-error" role="alert">{error}</span>}<button className="btn btn-primary" style={{minHeight:34,padding:"0 11px"}} onClick={create} disabled={loading}>{loading?<LoaderCircle size={14}/>:<CreditCard size={14}/>}Crear link de pago</button></div>;
}
