import type { CSSProperties, ReactNode } from "react";
import type { Texture } from "@/domain/config/storefront";

/**
 * Foto de producto o, si todavía no hay, una textura de grano del mismo producto.
 * Es un fondo CSS (no <img>) para que foto y textura ocupen exactamente el mismo marco.
 */
export function Visual({ image, texture, className, children, label }: { image?: string; texture?: Texture; className?: string; children?: ReactNode; label?: string }) {
  const style: CSSProperties | undefined = image ? { backgroundImage: `url(${image})` } : undefined;
  return <div className={`st-visual ${className ?? ""}`} data-texture={image ? undefined : texture ?? "semilla"} style={style} role={label ? "img" : undefined} aria-label={label}>
    {children}
  </div>;
}
