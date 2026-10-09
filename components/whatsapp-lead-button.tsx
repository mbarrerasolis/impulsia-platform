"use client";

import { usePathname } from "next/navigation";
import { ArrowRight, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { isPrivatePath } from "@/lib/public-paths";
import { trackMetaEvent } from "@/lib/marketing/browser";

/** `fallback`: adónde llevar mientras no hay número de WhatsApp (por defecto, al diagnóstico). */
export function WhatsAppLeadButton({ brandName, number, message, fallback = { href: "/diagnostico", label: "Cuéntanos tu proceso ahora" } }: { brandName: string; number?: string; message: string; fallback?: { href: string; label: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (isPrivatePath(pathname)) return null;

  const href = number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : undefined;

  return (
    <div className="whatsapp-entry">
      {open && !href && (
        <section className="whatsapp-card" aria-live="polite">
          <button className="whatsapp-close" type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
            <X size={16} />
          </button>
          <span className="whatsapp-kicker">CANAL EN PREPARACIÓN</span>
          <strong>Pronto podrás conversar por WhatsApp</strong>
          <p>Estamos conectando el número oficial y el asistente de orientación.</p>
          <a href={fallback.href} className="whatsapp-fallback" onClick={() => setOpen(false)}>
            {fallback.label} <ArrowRight size={15} />
          </a>
        </section>
      )}
      {href ? (
        <a className="whatsapp-button" href={href} target="_blank" rel="noreferrer" onClick={() => trackMetaEvent("Contact")} aria-label={`Conversar con ${brandName} por WhatsApp`}>
          <MessageCircle size={24} />
          <span>WhatsApp</span>
        </a>
      ) : (
        <button className="whatsapp-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <MessageCircle size={24} />
          <span>WhatsApp</span>
        </button>
      )}
    </div>
  );
}
