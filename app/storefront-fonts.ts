import { Alfa_Slab_One, Figtree, Gabarito } from "next/font/google";

/**
 * Tipografías de la vitrina: slab gruesa para los títulos grandes (la voz del logotipo),
 * Gabarito para títulos chicos, precios y botones, y Figtree para leer.
 */
const display = Alfa_Slab_One({ subsets: ["latin"], weight: "400", variable: "--st-font-display", display: "swap" });
const head = Gabarito({ subsets: ["latin"], weight: ["500", "700", "800", "900"], variable: "--st-font-head", display: "swap" });
const text = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--st-font-text", display: "swap" });

/** Clases para el contenedor `.st` de la vitrina. */
export const storefrontFontClasses = `${display.variable} ${head.variable} ${text.variable}`;
