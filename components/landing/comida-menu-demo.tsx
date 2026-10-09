"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Minus, Plus } from "lucide-react";

type Item = { name: string; detail: string; price: number };
type Menu = { emoji: string; categories: { name: string; items: Item[] }[] };

const drinks = { name: "Bebidas", items: [{ name: "Bebida lata", detail: "350 ml", price: 1500 }, { name: "Bebida 1,5 L", detail: "Para compartir", price: 2900 }] };

/** Productos y precios de muestra por rubro: sólo ilustran cómo se vería el menú, no son los del local. */
const menus: Record<string, Menu> = {
  pizza: { emoji: "🍕", categories: [
    { name: "Pizzas", items: [{ name: "Margarita", detail: "Tomate, mozzarella, albahaca", price: 9990 }, { name: "Pepperoni", detail: "Doble pepperoni", price: 11990 }, { name: "Napolitana", detail: "Tomate, orégano, aceitunas", price: 11490 }] },
    { name: "Para acompañar", items: [{ name: "Palitos de ajo", detail: "8 unidades", price: 3490 }, { name: "Alitas BBQ", detail: "8 unidades", price: 5990 }] },
    drinks,
  ] },
  hamburguesa: { emoji: "🍔", categories: [
    { name: "Hamburguesas", items: [{ name: "Cheese bacon", detail: "Doble queso cheddar y tocino", price: 7900 }, { name: "Doble smash", detail: "Dos carnes, pepinillos, salsa", price: 8900 }, { name: "Veggie", detail: "Hamburguesa de garbanzo", price: 7500 }] },
    { name: "Papas", items: [{ name: "Papas grandes", detail: "Corte rústico", price: 3500 }, { name: "Aros de cebolla", detail: "10 unidades", price: 3200 }] },
    drinks,
  ] },
  sushi: { emoji: "🍣", categories: [
    { name: "Rolls", items: [{ name: "California", detail: "Kanikama, palta, sésamo", price: 5900 }, { name: "Acevichado", detail: "Salmón, salsa acevichada", price: 6900 }, { name: "Tempura", detail: "Pollo, queso crema", price: 6500 }] },
    { name: "Promos", items: [{ name: "Promo 40 piezas", detail: "Mix de rolls", price: 18900 }, { name: "Gyozas", detail: "5 unidades", price: 4200 }] },
    drinks,
  ] },
  completos: { emoji: "🌭", categories: [
    { name: "Completos", items: [{ name: "Italiano", detail: "Tomate, palta, mayo", price: 3200 }, { name: "Dinámico", detail: "Italiano con americana", price: 3500 }] },
    { name: "Sándwiches", items: [{ name: "Churrasco italiano", detail: "Pan frica", price: 6900 }, { name: "Barros Luco", detail: "Carne y queso fundido", price: 7200 }] },
    drinks,
  ] },
  pollo: { emoji: "🍗", categories: [
    { name: "Pollo", items: [{ name: "Cuarto de pollo", detail: "Con papas fritas", price: 6500 }, { name: "Medio pollo", detail: "Con papas fritas", price: 8900 }, { name: "Alitas BBQ", detail: "8 unidades", price: 6900 }] },
    { name: "Acompañamientos", items: [{ name: "Papas fritas", detail: "Porción grande", price: 2800 }, { name: "Ensalada chilena", detail: "Tomate y cebolla", price: 2500 }] },
    drinks,
  ] },
  arabe: { emoji: "🥙", categories: [
    { name: "Platos", items: [{ name: "Shawarma de pollo", detail: "Pan pita, salsa de ajo", price: 6500 }, { name: "Falafel", detail: "6 unidades con hummus", price: 5900 }] },
    { name: "Para compartir", items: [{ name: "Hummus", detail: "Con pan pita", price: 3900 }, { name: "Empanadas árabes", detail: "3 unidades", price: 4500 }] },
    drinks,
  ] },
};

const clp = (value: number) => `$${value.toLocaleString("es-CL")}`;

/**
 * Teléfono interactivo: el visitante arma un pedido en un menú de muestra con el nombre de su local y ve cómo le
 * llega a WhatsApp, ya ordenado. Productos y precios ilustrativos.
 */
export function ComidaMenuDemo({ negocio, rubro }: { negocio: string; rubro: string }) {
  const menu = menus[rubro] ?? menus.hamburguesa;
  const [tab, setTab] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sent, setSent] = useState(false);
  const chat = useRef<HTMLDivElement>(null);
  // Los mensajes aparecen de a uno: el chat sigue al último, como en WhatsApp.
  useEffect(() => {
    if (!sent) return;
    const timers = [400, 1300, 2200, 3000, 3800].map((ms) => setTimeout(() => chat.current?.scrollTo({ top: chat.current.scrollHeight, behavior: "smooth" }), ms));
    return () => timers.forEach(clearTimeout);
  }, [sent]);
  const all = menu.categories.flatMap((category) => category.items);
  const lines = all.filter((item) => cart[item.name]).map((item) => ({ ...item, qty: cart[item.name] }));
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const change = (name: string, delta: number) => setCart((current) => {
    const next = { ...current, [name]: Math.max(0, (current[name] ?? 0) + delta) };
    if (!next[name]) delete next[name];
    return next;
  });

  return <div className="cm-demo-phone" aria-label={`Menú de muestra de ${negocio}`}>
    <div className="cm-demo-screen">
      {!sent ? <>
        <div className="cm-demo-top">
          <span className="cm-demo-logo" aria-hidden="true">{menu.emoji}</span>
          <div><b>{negocio}</b><small><span className="cm-demo-dot" /> Abierto · despacho y retiro</small></div>
        </div>
        <div className="cm-demo-tabs" role="tablist">{menu.categories.map((category, index) =>
          <button key={category.name} type="button" role="tab" aria-selected={tab === index} onClick={() => setTab(index)}>{category.name}</button>)}
        </div>
        <ul className="cm-demo-items">{menu.categories[tab].items.map((item, index) => <li key={item.name}>
          <div><b>{item.name}</b><small>{item.detail}</small><span>{clp(item.price)}</span></div>
          {cart[item.name]
            ? <span className="cm-demo-qty">
              <button type="button" aria-label={`Quitar ${item.name}`} onClick={() => change(item.name, -1)}><Minus size={16} strokeWidth={3} /></button>
              <b>{cart[item.name]}</b>
              <button type="button" aria-label={`Agregar otro ${item.name}`} onClick={() => change(item.name, 1)}><Plus size={16} strokeWidth={3} /></button>
            </span>
            : <button type="button" className={`cm-demo-add${!count && tab === 0 && index === 0 ? " cm-demo-hint" : ""}`} aria-label={`Agregar ${item.name}`} onClick={() => change(item.name, 1)}><Plus size={18} strokeWidth={3} /></button>}
        </li>)}</ul>
        <button type="button" className="cm-demo-cart" disabled={!count} onClick={() => setSent(true)}>
          {count
            ? <><span className="cm-demo-count">{count}</span> Pedir por WhatsApp <b>{clp(total)}</b></>
            : <>Toca + para armar un pedido de prueba</>}
        </button>
      </> : <>
        <div className="cm-demo-top cm-demo-wa">
          <button type="button" className="cm-demo-back" aria-label="Volver al menú" onClick={() => setSent(false)}><ArrowLeft size={20} /></button>
          <span className="cm-demo-logo" aria-hidden="true">{menu.emoji}</span>
          <div><b>{negocio}</b><small>en línea</small></div>
        </div>
        <div className="cm-demo-chat" aria-live="polite" ref={chat}>
          <div className="cm-demo-bubble cm-demo-in">
            Hola! Quiero pedir:
            <span className="cm-order">{lines.map((line) => <span key={line.name} className="cm-order-row"><span>{line.qty} × {line.name}</span><span>{clp(line.qty * line.price)}</span></span>)}<b>Total</b><b>{clp(total)}</b></span>
          </div>
          <p className="cm-demo-bubble cm-demo-out">¡Hola! Tu pedido quedó así ☝️ ¿Es para despacho o retiro? Si es despacho, me indicas la dirección y te confirmo el envío.</p>
          <p className="cm-demo-bubble cm-demo-in">Despacho a Los Aromos 123, depto 41</p>
          <p className="cm-demo-bubble cm-demo-out">Listo ✅ Te paso los datos para transferir. Apenas el local confirme el pago, empiezan a prepararlo.</p>
          <p className="cm-demo-done"><Check size={16} strokeWidth={3} /> Tu equipo recibe el pedido completo: productos, total y dirección.</p>
        </div>
        <button type="button" className="cm-demo-cart" onClick={() => { setSent(false); setCart({}); setTab(0); }}>Probar otro pedido</button>
      </>}
    </div>
  </div>;
}
