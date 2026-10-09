import "server-only";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import activeEdition from "@/config/edition.json";
import { businessVocabulary, parseBusinessProfile, type BusinessProfile, type ModuleKey, type SectorLanding } from "@/domain/config/business";

let cached: BusinessProfile | undefined;

/** Perfil de negocio y módulos de la edición activa (`config/edition.json`). */
export function getBusinessProfile(): BusinessProfile {
  return cached ??= parseBusinessProfile(activeEdition);
}

export function isModuleEnabled(module: ModuleKey) {
  return getBusinessProfile().modules[module];
}

export function getVocabulary() {
  return businessVocabulary(getBusinessProfile().model);
}

/** Para páginas y layouts: un módulo apagado responde 404, como si la ruta no existiera. */
export function requireModule(module: ModuleKey) {
  if (!isModuleEnabled(module)) notFound();
}

/** Para rutas de API: `undefined` si el módulo está activo; si no, la respuesta 404 a devolver. */
export function moduleDisabledResponse(module: ModuleKey) {
  return isModuleEnabled(module) ? undefined : NextResponse.json({ error: "Este módulo no está activo en esta edición." }, { status: 404 });
}

/** Landings sectoriales (p. ej. /salud): sólo existen en las ediciones que las declaran. */
export function requireSectorLanding(landing: SectorLanding) {
  if (!getBusinessProfile().sectorLandings.includes(landing)) notFound();
}
