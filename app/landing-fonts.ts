import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";

/** Tipografías del sitio público: Bricolage para títulos, Atkinson Hyperlegible para lectura. */
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--lp-font-display", display: "swap" });
const text = Atkinson_Hyperlegible_Next({ subsets: ["latin"], weight: ["400", "700", "800"], variable: "--lp-font-text", display: "swap", adjustFontFallback: false });

/** Clases para el contenedor `.lp` de las páginas públicas. */
export const landingFontClasses = `${display.variable} ${text.variable}`;
