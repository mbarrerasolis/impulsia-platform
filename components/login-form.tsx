"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";

export function LoginForm({enabled}:{enabled:boolean}){
  const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setLoading(true); setError(""); const form=new FormData(event.currentTarget);
    try { const response=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:form.get("email"),password:form.get("password")})}); const result=await response.json() as {error?:string;redirectTo?:string}; if(!response.ok) throw new Error(result.error??"No fue posible iniciar sesión."); window.location.assign(result.redirectTo??"/admin/dashboard"); }
    catch(cause){setError(cause instanceof Error?cause.message:"No fue posible iniciar sesión.");setLoading(false);}
  }
  return <form onSubmit={submit}><div className="field"><label htmlFor="login-email">Email</label><input id="login-email" name="email" type="email" required autoComplete="email" disabled={!enabled} placeholder="nombre@empresa.cl"/></div><div className="field"><label htmlFor="login-password">Contraseña</label><input id="login-password" name="password" type="password" required minLength={8} autoComplete="current-password" disabled={!enabled} placeholder="••••••••"/></div>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={!enabled||loading} style={{width:"100%"}}>{loading&&<LoaderCircle size={17}/>}Ingresar</button></form>;
}
