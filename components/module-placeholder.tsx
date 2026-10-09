import { Construction } from "lucide-react";

export function ModulePlaceholder({title,description,next}:{title:string;description:string;next:string}){
  return <><div className="admin-title"><div><h1>{title}</h1><p className="muted">{description}</p></div></div><section className="card panel" style={{minHeight:320,display:"grid",placeItems:"center",textAlign:"center"}}><div><span className="feature-icon" style={{margin:"0 auto"}}><Construction size={21}/></span><h2 style={{marginTop:20}}>Base preparada</h2><p className="muted" style={{maxWidth:520,lineHeight:1.65}}>{next}</p><span className="demo-badge">SIGUIENTE BLOQUE</span></div></section></>;
}
