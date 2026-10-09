import { NewSaleForm } from "@/components/sale-editor";
import { normalizeStoredPhone } from "@/domain/crm/phone";
import { requireRole } from "@/lib/auth/authorization";
import { getLeadRepository } from "@/repositories";
import { saleCatalogOptions } from "@/services/store/sales-runtime";

type SearchParams = Record<string, string | string[] | undefined>;

/** Cotización armada por el equipo; desde la ficha de un lead llega con sus datos (?lead=<id>). */
export default async function NewSalePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["owner_admin", "sales", "finance"]);
  const leadParam = (await searchParams).lead;
  const leadId = typeof leadParam === "string" && /^[0-9a-f-]{36}$/i.test(leadParam) ? leadParam : undefined;
  const [options, lead] = await Promise.all([saleCatalogOptions(), leadId ? getLeadRepository().find(leadId) : undefined]);
  return <>
    <div className="admin-title">
      <div>
        <h1>Nueva cotización</h1>
        <p className="muted">Los precios se calculan con el catálogo vigente (incluido el precio por volumen). Queda en preparación hasta que la marques enviada.</p>
      </div>
    </div>
    <NewSaleForm options={options} {...(lead ? { leadId: lead.id, defaults: { name: lead.name, company: lead.company, phone: normalizeStoredPhone(lead.phone) ?? lead.phone, email: lead.email } } : {})} />
  </>;
}
