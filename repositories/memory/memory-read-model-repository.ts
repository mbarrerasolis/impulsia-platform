import type { ReadModelRepository } from "@/repositories/read-model-repository";
import { demoStore } from "./demo-store";
import { buildDashboardSnapshot } from "@/domain/analytics/dashboard";
import { createPageResult, normalizePageRequest } from "@/lib/pagination";

export class MemoryReadModelRepository implements ReadModelRepository {
  async listAccounts(){return [...demoStore.accounts];}
  async listAccountsPage(input = {}){const {page,pageSize,from,to,search}=normalizePageRequest(input);const needle=search?.toLocaleLowerCase("es-CL");const rows=demoStore.accounts.filter((item)=>!needle||item.tradeName.toLocaleLowerCase("es-CL").includes(needle)||item.legalName.toLocaleLowerCase("es-CL").includes(needle));return createPageResult(rows.slice(from,to+1),rows.length,page,pageSize);}
  async findAccount(id:string){return demoStore.accounts.find((item)=>item.id===id);}
  async listContacts(accountId:string){return demoStore.contacts.filter((item)=>item.accountId===accountId);}
  async findQuote(id:string){return demoStore.quotes.find((item)=>item.id===id);}
  async listSolutions(){return [...demoStore.solutions];}
  async listSolutionsPage(input = {}){const {page,pageSize,from,to}=normalizePageRequest(input);const rows=demoStore.solutions.map((item)=>({...item,accountName:demoStore.accounts.find((account)=>account.id===item.accountId)?.tradeName??"Cuenta",pricingVersion:item.pricingSnapshot.version}));return createPageResult(rows.slice(from,to+1),rows.length,page,pageSize);}
  async listPortalSolutions(){return demoStore.solutions.map(({id,accountId,name,status,estimatedDays})=>({id,accountId,name,status,estimatedDays}));}
  async listBillingPeriods(){return [...demoStore.billingPeriods];}
  async listBillingPeriodsPage(input = {}){const {page,pageSize,from,to}=normalizePageRequest(input);const rows=[...demoStore.billingPeriods].reverse().map((item)=>({...item,accountName:demoStore.accounts.find((account)=>account.id===item.accountId)?.tradeName??"Cuenta"}));return createPageResult(rows.slice(from,to+1),rows.length,page,pageSize);}
  async getDashboardReadModel(){const snapshot=buildDashboardSnapshot({accounts:demoStore.accounts,leads:demoStore.leads,solutions:demoStore.solutions,billingPeriods:demoStore.billingPeriods,tasks:[]});return {snapshot,accountTotal:demoStore.accounts.length,leadTotal:demoStore.leads.length,hasOperation:Boolean(demoStore.accounts.length||demoStore.leads.length||demoStore.solutions.length||demoStore.billingPeriods.length)};}
  async listTasks(){return [];}
  async listInternalProfiles(){return [];}
}
