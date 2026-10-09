"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  /** Si es true, formatea miles con separador es-CL (2840 -> "2.840"). */
  thousands?: boolean;
}

/** Anima de 0 al valor final cuando la tarjeta entra en pantalla. */
export function AnimatedCounter({ value, duration = 1100, prefix = "", suffix = "", thousands = false }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const effectiveDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        function tick(now: number) {
          const progress = effectiveDuration === 0 ? 1 : Math.min(1, (now - start) / effectiveDuration);
          const eased = 1 - (1 - progress) ** 3;
          setDisplay(Math.round(value * eased));
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration]);

  const formatted = thousands ? display.toLocaleString("es-CL") : String(display);
  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}
