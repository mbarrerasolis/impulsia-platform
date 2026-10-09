import type { AccountSummary, Contact } from "@/domain/crm/entities";
import type { BillingPeriodRecord, ClientSolutionRecord, ImplementationTaskRecord, QuoteRecord } from "@/domain/operations/entities";
import type { DashboardSnapshot } from "@/domain/analytics/dashboard";
import type { PageRequest, PageResult } from "@/lib/pagination";

export interface PortalSolutionSummary {
  id: string;
  accountId: string;
  name: string;
  status: ClientSolutionRecord["status"];
  estimatedDays: number;
}

export interface InternalProfileSummary {
  id: string;
  displayName: string;
}

export interface ClientSolutionListItem {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  status: ClientSolutionRecord["status"];
  estimatedDays: number;
  netImplementationPrice: number;
  netMaintenanceIncrement: number;
  pricingVersion: string;
  createdAt: string;
}

export interface BillingPeriodListItem {
  id: string;
  accountId: string;
  accountName: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: BillingPeriodRecord["status"];
}

export interface DashboardReadModel {
  snapshot: DashboardSnapshot;
  accountTotal: number;
  leadTotal: number;
  hasOperation: boolean;
}

export interface ReadModelRepository {
  listAccounts():Promise<AccountSummary[]>;
  listAccountsPage(input?:PageRequest):Promise<PageResult<AccountSummary>>;
  findAccount(id:string):Promise<AccountSummary|undefined>;
  listContacts(accountId:string):Promise<Contact[]>;
  findQuote(id:string):Promise<QuoteRecord|undefined>;
  listSolutions():Promise<ClientSolutionRecord[]>;
  listSolutionsPage(input?:PageRequest):Promise<PageResult<ClientSolutionListItem>>;
  listPortalSolutions():Promise<PortalSolutionSummary[]>;
  listBillingPeriods():Promise<BillingPeriodRecord[]>;
  listBillingPeriodsPage(input?:PageRequest):Promise<PageResult<BillingPeriodListItem>>;
  getDashboardReadModel():Promise<DashboardReadModel>;
  listTasks(clientSolutionId:string):Promise<ImplementationTaskRecord[]>;
  listInternalProfiles():Promise<InternalProfileSummary[]>;
}
