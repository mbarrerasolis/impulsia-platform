import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { routeError } from "@/lib/http/route-error";
import { getOperationsRepository } from "@/repositories";
import { ProcessPaymentEventService } from "@/services/billing/payment-flow";

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
  try{if(getServerEnv().APP_MODE!=="demo") return NextResponse.json({error:"Ruta disponible sólo en modo demo."},{status:404});const {id}=await params;const payment=await getOperationsRepository().findPaymentByPeriod(id);if(!payment) return NextResponse.json({error:"Primero crea el link de pago desde Cobranza."},{status:409});const result=await new ProcessPaymentEventService(getOperationsRepository()).execute({periodId:id,externalEventId:`mock-approved-${payment.id}`});return NextResponse.json(result);}
  catch(error){return routeError(error,"mock.payment.failed");}
}
