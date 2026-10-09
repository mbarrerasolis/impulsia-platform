"use client";

import { Children, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Carousel({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const go = (delta: number) => setIndex((current) => (current + delta + slides.length) % slides.length);

  return (
    <div className="carousel">
      <div className="carousel-viewport">
        <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((slide, i) => (
            <div className="carousel-slide" key={i}>{slide}</div>
          ))}
        </div>
      </div>
      <div className="carousel-controls">
        <button type="button" className="carousel-arrow" onClick={() => go(-1)} aria-label="Lámina anterior"><ChevronLeft size={18} /></button>
        <div className="carousel-dots">
          {slides.map((_, i) => (
            <button type="button" key={i} className={`carousel-dot ${i === index ? "active" : ""}`} onClick={() => setIndex(i)} aria-label={`Ir a la lámina ${i + 1}`} />
          ))}
        </div>
        <button type="button" className="carousel-arrow" onClick={() => go(1)} aria-label="Lámina siguiente"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}
