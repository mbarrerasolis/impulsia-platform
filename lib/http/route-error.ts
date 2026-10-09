import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiAuthorizationError } from "@/lib/auth/api-authorization";

export function routeError(error: unknown, label: string) {
  if (error instanceof ApiAuthorizationError) return NextResponse.json({error:error.message},{status:error.status});
  if (error instanceof ZodError) return NextResponse.json({error:"Revisa los datos ingresados.",issues:error.issues.map(({path,message})=>({path,message}))},{status:400});
  const message=error instanceof Error?error.message:"Error inesperado.";
  const expected=["no encontrado","no encontrada","ya fue","no admite","no coincide","inexistente","no es un perfil interno válido"];
  if(expected.some((text)=>message.toLowerCase().includes(text))) return NextResponse.json({error:message},{status:409});
  console.error(label,{message});
  return NextResponse.json({error:"No fue posible completar la operación."},{status:500});
}
