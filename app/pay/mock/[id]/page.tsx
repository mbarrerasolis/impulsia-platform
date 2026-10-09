import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { MockPaymentCard } from "@/components/mock-payment-card";
import { getBrandConfig } from "@/lib/brand";
import { formatClp } from "@/lib/format";
import { getOperationsRepository } from "@/repositories";

export const metadata: Metadata = { title: "Pago de prueba", robots: { index: false, follow: false } };

export default async function MockPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = getBrandConfig();
  const repository = getOperationsRepository();
  const period = await repository.findBillingPeriod(id);
  const payment = await repository.findPaymentByPeriod(id);
  if (!period || !payment) notFound();

  return <div className="page-shell">
    <header className="site-header">
      <div className="container nav"><Brand name={brand.name}/><span className="demo-badge">PAGO MOCK · SIN DINERO REAL</span></div>
    </header>
    <main className="container" style={{minHeight:"calc(100vh - 70px)",display:"grid",placeItems:"center",paddingBlock:40}}>
      <section className="card" style={{width:"min(500px,100%)",padding:38}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:20,borderBottom:"1px solid var(--line)",paddingBottom:20,marginBottom:28}}>
          <span className="muted">Total a pagar</span><strong style={{fontSize:25}}>{formatClp(period.amountDue)}</strong>
        </div>
        <MockPaymentCard periodId={id} initialStatus={period.status}/>
      </section>
    </main>
  </div>;
}
