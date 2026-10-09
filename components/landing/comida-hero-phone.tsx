import { Check, ClipboardList, Zap } from "lucide-react";

/** Teléfono del hero de /comida: un cliente pide desde el menú y el agente deja el pedido armado. Ejemplo ilustrativo. */
export function ComidaHeroPhone() {
  return <figure className="sl-hero-visual" aria-label="Ejemplo: un cliente pide por WhatsApp y el agente deja el pedido armado para el local">
    <div className="sl-phone">
      <div className="sl-phone-top">
        <span className="sl-phone-avatar"><Zap size={22} fill="currentColor" strokeWidth={0} /></span>
        <div><b>Burger de ejemplo · Pedidos</b><small>en línea</small></div>
      </div>
      <div className="sl-chat">
        <p className="sl-bubble sl-in">Hola! Quiero 2 cheese bacon y unas papas grandes 🍔<time>20:14</time></p>
        <div className="sl-bubble sl-out">¡Hola Diego! Te lo dejo así:
          <span className="cm-order"><span>2 × Cheese bacon</span><span>$15.800</span><span>1 × Papas grandes</span><span>$3.500</span><b>Total</b><b>$19.300</b></span>
          ¿Despacho o retiro?<time>20:14</time>
        </div>
        <p className="sl-bubble sl-in">Despacho a Los Aromos 123, depto 41<time>20:15</time></p>
        <p className="sl-bubble sl-out">Listo ✅ Envío $2.000, total <b>$21.300</b>. Te paso los datos para transferir y el local confirma al recibir el pago.<time>20:15</time></p>
      </div>
    </div>
    <div className="sl-event">
      <span className="sl-event-ok"><Check size={22} strokeWidth={3.5} /></span>
      <span className="sl-event-head"><ClipboardList size={20} /> Nuevo pedido</span>
      <strong>$21.300</strong>
      <span className="sl-event-who">Diego · despacho · 3 productos</span>
      <span className="sl-event-tags"><span>Pago por revisar</span><span>Tu equipo confirma</span></span>
    </div>
    <figcaption className="sl-note">Ejemplo ilustrativo</figcaption>
  </figure>;
}
