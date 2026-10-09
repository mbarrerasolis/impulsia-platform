import { NextResponse } from "next/server";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { ManageTaskService } from "@/services/operations/manage-task";
import { moduleDisabledResponse } from "@/lib/business";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const disabled = moduleDisabledResponse("subscriptions");
  if (disabled) return disabled;
  try{await requireInternalApiRole();const {id}=await params;await new ManageTaskService().update(id,await request.json());return NextResponse.json({ok:true});}
  catch(error){return routeError(error,"task.update.failed");}
}
