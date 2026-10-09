"use client";

import type { ReactNode } from "react";
import { attributionRefCode } from "@/domain/marketing/attribution";
import { readAttribution } from "@/lib/marketing/browser";

const waHref = (number: string, message: string) => `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

/**
 * Enlace a WhatsApp con texto prellenado que, si la visita trae procedencia (UTM de un correo, anuncio o publicación),
 * agrega el código "[ref: …]" para que el CRM sepa de qué campaña y variante vino la conversación. El código se arma al
 * hacer clic: así no depende de que la procedencia ya estuviera guardada cuando se pintó la página.
 */
export function WhatsAppRefLink({ number, text, className, children }: { number: string; text: string; className?: string; children: ReactNode }) {
  return <a
    className={className}
    href={waHref(number, text)}
    target="_blank"
    rel="noreferrer"
    onClick={(event) => {
      const code = attributionRefCode(readAttribution());
      if (code) event.currentTarget.href = waHref(number, `${text} ${code}`);
    }}
  >{children}</a>;
}
