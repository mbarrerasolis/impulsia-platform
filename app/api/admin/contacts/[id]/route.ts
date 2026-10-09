import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { ManageContactService } from "@/services/crm/manage-contact";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    await requireInternalApiRole();
    const {id}=await params;
    const body=await request.json();
    const {accountId,...rest}=z.object({accountId:z.string().min(1)}).passthrough().parse(body);
    await new ManageContactService().update(id,accountId,rest);
    return NextResponse.json({ok:true});
  }
  catch(error){return routeError(error,"contact.update.failed");}
}
