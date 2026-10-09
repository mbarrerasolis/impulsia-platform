import { z } from "zod";
import { calculateExpansionQuote } from "@/domain/pricing/engine";
import { getServerEnv } from "@/lib/env";
import { getEditionConfig } from "@/lib/edition";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toJson } from "@/lib/supabase/json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MemoryOperationsRepository } from "@/repositories/memory/memory-operations-repository";
import { ConvertLeadService } from "@/services/crm/convert-lead";
import { CreateQuoteService, createQuoteSchema } from "@/services/quotes/create-quote";
import { ApproveQuoteService } from "@/services/quotes/approve-quote";

export interface OperationsWorkflow {
  convertLead(leadId:string,input:unknown):Promise<{account:{id:string}}>;
  createQuote(input:unknown):Promise<{quote:{id:string;netImplementation:number}}>;
  approveQuote(quoteId:string):Promise<{result:{billingPeriod:{id:string}}}>;
}

export class MemoryOperationsWorkflow implements OperationsWorkflow {
  constructor(private readonly actorUserId:string,private readonly repository=new MemoryOperationsRepository()){}
  async convertLead(leadId:string,input:unknown){const body=z.object({industry:z.string().trim().min(2).max(100)}).parse(input);const account=await new ConvertLeadService(this.repository,{actorUserId:this.actorUserId}).execute({leadId,industry:body.industry});return {account:{id:account.id}};}
  async createQuote(input:unknown){const quote=await new CreateQuoteService(this.repository,{actorUserId:this.actorUserId,pricingRules:getEditionConfig().pricing}).execute(input);return {quote:{id:quote.id,netImplementation:quote.netImplementation}};}
  async approveQuote(quoteId:string){const result=await new ApproveQuoteService(this.repository,{actorUserId:this.actorUserId}).execute(quoteId);return {result:{billingPeriod:{id:result.billingPeriod.id}}};}
}

const conversionResult=z.object({accountId:z.string(),contactId:z.string()});
const approvalResult=z.object({solutionId:z.string(),subscriptionId:z.string(),billingPeriodId:z.string(),amountDue:z.number()});

export class SupabaseOperationsWorkflow implements OperationsWorkflow {
  constructor(private readonly actorUserId:string){}
  async convertLead(leadId:string,input:unknown){
    const body=z.object({industry:z.string().trim().min(2).max(100)}).parse(input);
    const client=await createSupabaseServerClient();
    const {data,error}=await client.rpc("convert_lead_to_account",{p_lead_id:leadId,p_industry:body.industry});
    if(error)throw new Error(`No fue posible convertir el lead: ${error.message}`);
    const result=conversionResult.parse(data);
    return {account:{id:result.accountId}};
  }
  async createQuote(input:unknown){
    const command=createQuoteSchema.parse(input);
    const pricingRules=getEditionConfig().pricing;
    const client=await createSupabaseServerClient();
    const [{data:account,error:accountError},{count,error:countError}]=await Promise.all([
      client.from("accounts").select("id").eq("id",command.accountId).single(),
      client.from("client_solutions").select("id",{count:"exact",head:true}).eq("account_id",command.accountId).neq("status","cancelled")
    ]);
    if(accountError||!account)throw new Error("Cuenta no encontrada.");
    if(countError)throw new Error(`No fue posible contar soluciones: ${countError.message}`);
    const quote=calculateExpansionQuote({
      estimatedDays:command.estimatedDays,complexity:command.complexity,activeSolutionsBeforeAddition:count??0,
      estimationNotes:command.estimationNotes,
      thirdPartyCosts:command.thirdPartyMonthlyCost>0?[{provider:"Proveedor por confirmar",description:"Costo externo mensual",cost:command.thirdPartyMonthlyCost,currency:pricingRules.currency,periodicity:"monthly",paidBy:"rebilled"}]:[]
    },pricingRules);
    const adminClient=createSupabaseAdminClient();
    const {data,error}=await adminClient.from("quotes").insert({
      account_id:command.accountId,name:command.name,status:"draft",estimated_days:quote.estimatedDays,
      complexity:quote.complexity,complexity_factor:quote.complexityFactor,day_rate_snapshot:quote.dayRate,
      gross_implementation_price:quote.grossImplementation,expansion_discount_percent:quote.expansionDiscountPercent,
      active_solutions_after_addition:quote.activeSolutionsAfterAddition,net_implementation_price:quote.netImplementation,
      gross_maintenance_increment:quote.grossMaintenanceIncrement,maintenance_discount_percent:quote.maintenanceDiscountPercent,
      net_maintenance_increment:quote.netMaintenanceIncrement,third_party_costs:toJson(quote.thirdPartyCosts),
      estimation_notes:quote.estimationNotes??null,pricing_rule_version:quote.pricingRuleVersion,
      pricing_snapshot:toJson(quote.pricingSnapshot),created_by:this.actorUserId
    }).select("id").single();
    if(error||!data)throw new Error(`No fue posible guardar la cotización: ${error?.message??"sin respuesta"}`);
    return {quote:{id:data.id,netImplementation:quote.netImplementation}};
  }
  async approveQuote(quoteId:string){
    const client=await createSupabaseServerClient();
    const {data,error}=await client.rpc("approve_quote_transaction",{p_quote_id:quoteId});
    if(error)throw new Error(`No fue posible aprobar la cotización: ${error.message}`);
    const result=approvalResult.parse(data);
    return {result:{billingPeriod:{id:result.billingPeriodId}}};
  }
}

export function createOperationsWorkflow(actorUserId:string):OperationsWorkflow {
  return getServerEnv().APP_MODE==="supabase"?new SupabaseOperationsWorkflow(actorUserId):new MemoryOperationsWorkflow(actorUserId);
}
