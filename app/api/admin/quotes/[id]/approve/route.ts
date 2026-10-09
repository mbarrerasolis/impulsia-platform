import { NextResponse } from "next/server";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { createOperationsWorkflow } from "@/services/workflows/operations-workflow";
import { moduleDisabledResponse } from "@/lib/business";

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
  const disabled = moduleDisabledResponse("quotes");
  if (disabled) return disabled;
  try{const actor=await requireInternalApiRole(["owner_admin","sales"]);const {id}=await params;const result=await createOperationsWorkflow(actor.id).approveQuote(id);return NextResponse.json(result);}
  catch(error){return routeError(error,"quote.approve.failed");}
}
