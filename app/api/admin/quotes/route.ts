import { NextResponse } from "next/server";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { createOperationsWorkflow } from "@/services/workflows/operations-workflow";
import { moduleDisabledResponse } from "@/lib/business";

export async function POST(request:Request){
  const disabled = moduleDisabledResponse("quotes");
  if (disabled) return disabled;
  try{const actor=await requireInternalApiRole(["owner_admin","sales"]);const result=await createOperationsWorkflow(actor.id).createQuote(await request.json());return NextResponse.json(result,{status:201});}
  catch(error){return routeError(error,"quote.create.failed");}
}
