import Link from "next/link";
import { Search } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { getReadModelRepository } from "@/repositories";
import { formatClp } from "@/lib/format";
import { parsePage } from "@/lib/pagination";

export default async function AccountsPage({searchParams}:{searchParams:Promise<{page?:string|string[];q?:string|string[]}>}){
  const params=await searchParams;const page=parsePage(params.page);const search=Array.isArray(params.q)?params.q[0]:params.q;const result=await getReadModelRepository().listAccountsPage({page,search});const accounts=result.items;
  return <><div className="admin-title"><div><h1>Cuentas</h1><p className="muted">Clientes y prospectos con su contexto comercial y operativo.</p></div><button className="btn btn-primary">Nueva cuenta</button></div><div className="card panel"><div className="panel-head"><form action="/admin/accounts" className="field" style={{margin:0,position:"relative"}}><Search size={16} style={{position:"absolute",left:12,top:14}}/><input aria-label="Buscar cuenta" name="q" defaultValue={search} placeholder="Buscar cuenta..." style={{paddingLeft:36}}/></form><span className="muted" style={{fontSize:12}}>{result.total} cuentas</span></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Cuenta</th><th>Estado</th><th>Industria</th><th>Contactos</th><th>Soluciones</th><th>MRR</th></tr></thead><tbody>{accounts.map(account=><tr key={account.id}><td><Link href={`/admin/accounts/${account.id}`}><strong>{account.tradeName}</strong><br/><span className="muted">{account.legalName}</span></Link></td><td><span className={`state ${account.status}`}>● {account.status}</span></td><td>{account.industry}</td><td>{account.contactCount}</td><td>{account.activeSolutions}</td><td><strong>{formatClp(account.mrr)}</strong></td></tr>)}</tbody></table></div><Pagination path="/admin/accounts" page={result.page} totalPages={result.totalPages} total={result.total} search={search}/></div></>;
}
