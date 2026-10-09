import { describe, expect, it } from "vitest";
import { createEmptyDemoStore } from "@/repositories/memory/demo-store";
import { MemoryOperationsRepository } from "@/repositories/memory/memory-operations-repository";
import { ConvertLeadService } from "@/services/crm/convert-lead";
import { CreateQuoteService } from "@/services/quotes/create-quote";
import { ApproveQuoteService } from "@/services/quotes/approve-quote";
import { CreatePaymentLinkService, ProcessPaymentEventService } from "@/services/billing/payment-flow";
import { MockPaymentProvider } from "@/integrations/payments/mock-payment-provider";
import { currentPricingRules } from "@/domain/pricing/rules";

function sequentialIds() {
  let value = 0;
  return () => `generated-${++value}`;
}

describe("flujo lead → cliente → solución → cobro", () => {
  it("conserva precios, crea recurrencia y procesa un pago de forma idempotente", async () => {
    const store = createEmptyDemoStore();
    store.leads.push({
      id:"lead-1", source:"web", name:"Ana Torres", company:"Empresa Prueba", email:"ana@example.com",
      rawNeedDescription:"Necesita automatizar un proceso operativo repetitivo.", systems:["ERP"], apiKnowledge:"unknown",
      primaryGoal:"Ahorrar tiempo", status:"qualified", score:80, consentGiven:true, createdAt:"2026-09-01T00:00:00.000Z"
    });
    const repository = new MemoryOperationsRepository(store);
    const now = () => new Date("2026-09-14T12:00:00.000Z");
    const account = await new ConvertLeadService(repository,{id:sequentialIds(),now}).execute({leadId:"lead-1",industry:"Servicios"});
    expect(account.status).toBe("prospect");
    expect(store.contacts[0].roles).toContain("commercial");
    expect(store.leads[0].convertedAccountId).toBe(account.id);

    const quote = await new CreateQuoteService(repository,{id:sequentialIds(),now}).execute({
      accountId:account.id,name:"Conciliación automatizada",estimatedDays:3,complexity:"medium",thirdPartyMonthlyCost:50_000
    });
    expect(quote.netImplementation).toBe(720_000);
    expect(quote.thirdPartyCosts[0].cost).toBe(50_000);

    const approved = await new ApproveQuoteService(repository,{id:sequentialIds(),now}).execute(quote.id);
    expect(approved.solution.pricingSnapshot.version).toBe("2026-09-v1");
    expect(approved.items.find((item)=>item.thirdParty)?.discountPercent).toBe(0);
    expect(approved.billingPeriod.amountDue).toBe(176_000);
    expect(await repository.listReminders(approved.billingPeriod.id)).toHaveLength(6);
    expect((await repository.findAccount(account.id))?.activeSolutions).toBe(1);

    const link = await new CreatePaymentLinkService(repository,new MockPaymentProvider(),sequentialIds()).execute(approved.billingPeriod.id);
    expect(link.url).toBe(`/pay/mock/${approved.billingPeriod.id}`);
    const processor = new ProcessPaymentEventService(repository,{id:sequentialIds(),now});
    const first = await processor.execute({periodId:approved.billingPeriod.id,externalEventId:"mock-event-1"});
    const duplicate = await processor.execute({periodId:approved.billingPeriod.id,externalEventId:"mock-event-1"});
    expect(first.cancelledReminders).toBe(6);
    expect(duplicate.idempotent).toBe(true);
    expect((await repository.findBillingPeriod(approved.billingPeriod.id))?.status).toBe("paid");
    expect((await repository.listReminders(approved.billingPeriod.id)).every((item)=>item.status==="cancelled")).toBe(true);
    expect(store.paymentEvents).toHaveLength(1);
    expect(store.auditLog.map((item)=>item.action)).toEqual(["lead.converted","quote.created","quote.approved","payment.approved"]);
  });

  it("no permite convertir dos veces el mismo lead", async () => {
    const store=createEmptyDemoStore();
    store.leads.push({id:"lead-1",source:"web",name:"Ana Torres",company:"Empresa",email:"ana@example.com",rawNeedDescription:"Proceso de prueba con suficiente detalle.",systems:[],apiKnowledge:"unknown",primaryGoal:"Ahorrar",status:"new",score:30,consentGiven:true,createdAt:"2026-09-01T00:00:00Z"});
    const repository=new MemoryOperationsRepository(store); const service=new ConvertLeadService(repository,{id:sequentialIds()});
    await service.execute({leadId:"lead-1",industry:"Servicios"});
    await expect(service.execute({leadId:"lead-1",industry:"Servicios"})).rejects.toThrow("ya fue convertido");
  });

  it("acumula una segunda solución en el período pendiente sin duplicar recordatorios",async()=>{
    const store=createEmptyDemoStore();
    store.accounts.push({id:"account-1",tradeName:"Expansión Demo",legalName:"Expansión Demo",status:"active",industry:"Servicios",contactCount:1,activeSolutions:0,mrr:0});
    const repository=new MemoryOperationsRepository(store);const now=()=>new Date("2026-09-14T12:00:00.000Z");
    const createQuote=new CreateQuoteService(repository,{id:sequentialIds(),now});
    const approve=new ApproveQuoteService(repository,{id:sequentialIds(),now});
    const first=await createQuote.execute({accountId:"account-1",name:"Primera solución",estimatedDays:3,complexity:"medium",thirdPartyMonthlyCost:0});
    await approve.execute(first.id);
    const second=await createQuote.execute({accountId:"account-1",name:"Segunda solución",estimatedDays:3,complexity:"medium",thirdPartyMonthlyCost:0});
    expect(second.expansionDiscountPercent).toBe(25);
    const result=await approve.execute(second.id);
    expect(store.billingPeriods).toHaveLength(1);
    expect(store.billingPeriods[0].amountDue).toBe(221_000);
    expect(store.reminders).toHaveLength(6);
    expect(result.subscription.id).toBe(store.subscriptions[0].id);
  });

  it("propaga la moneda configurada a cotización, costos y suscripción",async()=>{
    const store=createEmptyDemoStore();
    store.accounts.push({id:"account-1",tradeName:"Edición México",legalName:"Edición México",status:"prospect",industry:"Servicios",contactCount:1,activeSolutions:0,mrr:0});
    const repository=new MemoryOperationsRepository(store);const now=()=>new Date("2026-09-14T12:00:00.000Z");
    const pricingRules={...currentPricingRules,currency:"MXN",version:"mx-1",dayRate:3_500,minimumImplementation:5_000,minimumMaintenance:900,roundingMultiple:100};
    const quote=await new CreateQuoteService(repository,{id:sequentialIds(),now,pricingRules}).execute({accountId:"account-1",name:"Automatización de reservas",estimatedDays:3,complexity:"medium",thirdPartyMonthlyCost:500});
    expect(quote.pricingSnapshot.currency).toBe("MXN");
    expect(quote.thirdPartyCosts[0]?.currency).toBe("MXN");
    const approved=await new ApproveQuoteService(repository,{id:sequentialIds(),now}).execute(quote.id);
    expect(approved.subscription.currency).toBe("MXN");
    const link=await new CreatePaymentLinkService(repository,new MockPaymentProvider(),sequentialIds(),"MXN").execute(approved.billingPeriod.id);
    expect(link.payment.currency).toBe("MXN");
  });
});
