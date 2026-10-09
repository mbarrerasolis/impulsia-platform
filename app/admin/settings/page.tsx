import { CheckCircle2, CircleDashed } from "lucide-react";
import { moduleKeys, moduleLabels } from "@/domain/config/business";
import activeEdition from "@/config/edition.json";
import { getBusinessProfile } from "@/lib/business";

const modelLabels = { b2b: "Empresas (B2B)", b2c: "Personas (B2C)", mixed: "Empresas y personas" } as const;
const offeringLabels = { services: "Servicios", products: "Productos", mixed: "Servicios y productos" } as const;

export default function SettingsPage() {
  const profile = getBusinessProfile();
  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Ajustes</h1>
          <p className="muted">Perfil de negocio y módulos de esta edición ({activeEdition.slug}).</p>
        </div>
      </div>
      <section className="admin-grid">
        <article className="card panel">
          <h2>Módulos</h2>
          {moduleKeys.map((key) => (
            <div className="pipeline-row" style={{ gridTemplateColumns: "28px 1fr auto" }} key={key}>
              {profile.modules[key] ? <CheckCircle2 size={17} color="var(--teal)" aria-hidden /> : <CircleDashed size={17} color="var(--muted)" aria-hidden />}
              <span>{moduleLabels[key]}</span>
              <span className={`state ${profile.modules[key] ? "active" : "paused"}`}>{profile.modules[key] ? "Activo" : "Apagado"}</span>
            </div>
          ))}
          {profile.sectorLandings.length > 0 && <p className="muted" style={{ marginTop: 12 }}>Landings sectoriales: {profile.sectorLandings.map((landing) => `/${landing}`).join(", ")}</p>}
        </article>
        <aside className="card panel">
          <h2>Perfil de negocio</h2>
          <p><strong>Vende a</strong><br /><span className="muted">{modelLabels[profile.model]}</span></p>
          <p><strong>Ofrece</strong><br /><span className="muted">{offeringLabels[profile.offering]}</span></p>
          <p className="muted" style={{ fontSize: 13 }}>Se configura en el manifiesto de la edición (<code>business</code> y <code>modules</code> en <code>config/edition.json</code>) y se valida con <code>npm run edition:validate</code>. Roles y usuarios se administran en Supabase Auth.</p>
        </aside>
      </section>
    </>
  );
}
