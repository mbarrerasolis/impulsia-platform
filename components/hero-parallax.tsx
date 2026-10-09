"use client";

import { useCallback, useRef, type ReactNode } from "react";

/** Mueve los blobs de fondo del hero según la posición del mouse, vía variables CSS heredadas (sin re-render). */
export function HeroParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useRef<boolean | null>(null);

  const handleMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (reduced.current === null) reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty("--mx", (x * 26).toFixed(1));
    node.style.setProperty("--my", (y * 26).toFixed(1));
  }, []);

  return (
    <section className="hero" ref={ref} onMouseMove={handleMove}>
      {children}
    </section>
  );
}
