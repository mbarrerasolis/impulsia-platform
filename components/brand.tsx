import { Zap } from "lucide-react";

/** Marca: isotipo de la edición si lo tiene (`emblem`, imagen en /public); si no, el rayo genérico. */
export function Brand({ name, emblem }: { name: string; emblem?: string }) {
  return <span className="brand">
    {emblem
      // eslint-disable-next-line @next/next/no-img-element -- isotipo SVG pequeño, sin optimización
      ? <img className="brand-emblem" src={emblem} alt="" width={38} height={38} />
      : <span className="brand-mark"><Zap size={18} fill="currentColor" /></span>}
    <span>{name}</span>
  </span>;
}
