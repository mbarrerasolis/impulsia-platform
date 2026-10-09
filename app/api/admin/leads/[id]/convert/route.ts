import { NextResponse } from "next/server";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { createOperationsWorkflow } from "@/services/workflows/operations-workflow";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const actor=await requireInternalApiRole(["owner_admin","sales"]);const {id}=await params;const result=await createOperationsWorkflow(actor.id).convertLead(id,await request.json());return NextResponse.json(result,{status:201});}
  catch(error){return routeError(error,"lead.convert.failed");}
}
