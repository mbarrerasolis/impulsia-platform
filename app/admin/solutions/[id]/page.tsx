import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { TasksPanel } from "@/components/tasks-panel";
import { getReadModelRepository } from "@/repositories";
import { getServerEnv } from "@/lib/env";
import { formatClp } from "@/lib/format";

export default async function SolutionDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const mode=getServerEnv().APP_MODE;
  const repository=getReadModelRepository();
  const [solutions,accounts,tasks,profiles]=await Promise.all([
    repository.listSolutions(),
    repository.listAccounts(),
    repository.listTasks(id),
    repository.listInternalProfiles(),
  ]);
  const solution=solutions.find(item=>item.id===id);
  if(!solution) notFound();
  const account=accounts.find(item=>item.id===solution.accountId);

  return <>
    <Link href="/admin/solutions" className="muted" style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:16,fontSize:13}}><ArrowLeft size={14}/> Volver a soluciones</Link>
    <div className="card account-header">
      <div className="account-name">
        <span className="avatar"><Layers size={21}/></span>
        <div><h1 style={{margin:0,fontSize:25}}>{solution.name}</h1><span className="muted">{account?.tradeName ?? "Cuenta"} · {solution.estimatedDays} jornadas</span></div>
      </div>
      <span className="state active">● {solution.status}</span>
    </div>
    <section className="stat-grid" style={{marginTop:16}}>
      <article className="card stat"><div className="stat-top">Implementación</div><div className="stat-value">{formatClp(solution.netImplementationPrice)}</div></article>
      <article className="card stat"><div className="stat-top">Mantención</div><div className="stat-value">{formatClp(solution.netMaintenanceIncrement)}</div></article>
      <article className="card stat"><div className="stat-top">Complejidad</div><div className="stat-value">{solution.complexityFactor}×</div></article>
    </section>
    <div style={{marginTop:16}}>
      <TasksPanel clientSolutionId={solution.id} tasks={tasks} profiles={profiles} editable={mode==="supabase"}/>
    </div>
  </>;
}
