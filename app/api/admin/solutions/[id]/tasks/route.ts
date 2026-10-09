import { NextResponse } from "next/server";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { ManageTaskService } from "@/services/operations/manage-task";
import { moduleDisabledResponse } from "@/lib/business";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const disabled = moduleDisabledResponse("subscriptions");
  if (disabled) return disabled;
  try{await requireInternalApiRole();const {id}=await params;const result=await new ManageTaskService().create(id,await request.json());return NextResponse.json(result,{status:201});}
  catch(error){return routeError(error,"task.create.failed");}
}
