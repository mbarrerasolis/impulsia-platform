import { NextResponse } from "next/server";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { createPaymentWorkflow } from "@/services/workflows/payment-workflow";
import { moduleDisabledResponse } from "@/lib/business";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const disabled = moduleDisabledResponse("subscriptions");
  if (disabled) return disabled;
  try{
    const actor=await requireInternalApiRole(["owner_admin","finance"]);
    const {id}=await params;
    const result=await createPaymentWorkflow().recordManualPayment(id,await request.json(),actor.id);
    return NextResponse.json(result);
  }
  catch(error){return routeError(error,"payment.manual.failed");}
}
