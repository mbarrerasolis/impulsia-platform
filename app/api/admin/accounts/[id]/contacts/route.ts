import { NextResponse } from "next/server";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { ManageContactService } from "@/services/crm/manage-contact";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{await requireInternalApiRole();const {id}=await params;const result=await new ManageContactService().create(id,await request.json());return NextResponse.json(result,{status:201});}
  catch(error){return routeError(error,"contact.create.failed");}
}
