import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getStorefront } from "@/lib/storefront";

const mimeTypes: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** Isotipo de la edición como data URI, para los íconos y la imagen social generados; `undefined` si no hay. */
export function getEmblemDataUri() {
  const emblem = getStorefront()?.emblem;
  if (!emblem) return undefined;
  const extension = emblem.split(".").pop()?.toLowerCase() ?? "";
  const file = readFileSync(join(process.cwd(), "public", emblem.slice(1)));
  return `data:${mimeTypes[extension] ?? "application/octet-stream"};base64,${file.toString("base64")}`;
}
