import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema=z.object({email:z.email(),password:z.string().min(8).max(200)});

export async function POST(request:Request){
  try{
    if(getServerEnv().APP_MODE!=="supabase") return NextResponse.json({error:"El acceso real está deshabilitado en modo demo."},{status:409});
    const credentials=credentialsSchema.parse(await request.json());
    const client=await createSupabaseServerClient();
    const {data,error}=await client.auth.signInWithPassword(credentials);
    if(error||!data.user) return NextResponse.json({error:"Email o contraseña incorrectos."},{status:401});
    const {data:profile}=await client.from("profiles").select("role").eq("id",data.user.id).single();
    if(!profile){await client.auth.signOut();return NextResponse.json({error:"La cuenta no tiene un perfil autorizado."},{status:403});}
    const redirectTo=String(profile.role).startsWith("client_")?"/portal":"/admin/dashboard";
    return NextResponse.json({redirectTo});
  }catch(error){
    if(error instanceof z.ZodError) return NextResponse.json({error:"Ingresa credenciales válidas."},{status:400});
    console.error("auth.login.failed",{message:error instanceof Error?error.message:"unknown"});
    return NextResponse.json({error:"No fue posible iniciar sesión."},{status:500});
  }
}
