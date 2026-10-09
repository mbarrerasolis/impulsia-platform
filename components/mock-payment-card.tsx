"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CreditCard, LoaderCircle } from "lucide-react";

export function MockPaymentCard({periodId,initialStatus}:{periodId:string;initialStatus:string}){
  const [status,setStatus]=useState(initialStatus);const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  async function pay(){setLoading(true);setError("");try{const response=await fetch(`/api/dev/payments/${periodId}/approve`,{method:"POST"});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error??"No fue posible aprobar el pago.");setStatus("paid");setLoading(false);}catch(cause){setError(cause instanceof Error?cause.message:"Error inesperado.");setLoading(false);}}
  if(status==="paid")return <div className="success-box"><span className="success-icon"><CheckCircle2 size={31}/></span><h2>Pago aprobado</h2><p className="muted">El período quedó pagado y sus recordatorios futuros fueron cancelados.</p><Link href="/admin/billing" className="btn btn-primary">Volver a cobranza</Link></div>;
  return <div><div style={{display:"grid",placeItems:"center",width:54,height:54,borderRadius:14,background:"var(--sky)",color:"var(--teal)",marginBottom:25}}><CreditCard size={25}/></div><h2>Simulador de pago</h2><p className="muted">No se procesará dinero real. Este botón emite un evento mock firmado internamente por el entorno de desarrollo.</p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" style={{width:"100%"}} onClick={pay} disabled={loading}>{loading&&<LoaderCircle size={17}/>}Simular pago aprobado</button></div>;
}
