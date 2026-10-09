"use client";

import { Star } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

const ratingWords = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"];

/**
 * "Califica tu compra": estrellas, comentario y nombre. La reseña queda por revisar; se publica
 * cuando el equipo la aprueba. Incluye el campo trampa y el tiempo de llenado del formulario de contacto.
 */
export function ReviewForm({ products, compact = false }: { products: string[]; compact?: boolean }) {
  // Momento en que se mostró el formulario: los bots lo envían al instante.
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);
  const [open, setOpen] = useState(!compact);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) { setError("Elige de 1 a 5 estrellas."); return; }
    const form = new FormData(event.currentTarget);
    setState("sending"); setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          body: form.get("body"),
          authorName: form.get("authorName"),
          productLabel: form.get("productLabel"),
          contact: form.get("contact"),
          website: form.get("website"),
          elapsedMs: Date.now() - startedAt.current,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No pudimos enviar tu reseña.");
      setState("sent");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos enviar tu reseña.");
      setState("idle");
    }
  }

  if (state === "sent") return <div className="st-review-form st-review-done" role="status">
    <span className="st-stars" aria-hidden="true">{[1, 2, 3, 4, 5].map((step) => <Star key={step} size={22} fill={rating >= step ? "currentColor" : "none"} />)}</span>
    <h3>¡Gracias por tu reseña!</h3>
    <p>La publicaremos en el sitio apenas la revisemos.</p>
  </div>;

  if (!open) return <button type="button" className="st-btn st-btn-peach" onClick={() => { startedAt.current = Date.now(); setOpen(true); }}>Califica tu compra</button>;

  const shown = hover || rating;
  return <form className="st-review-form" onSubmit={submit} noValidate>
    <fieldset className="st-rate">
      <legend>¿Cómo fue tu compra?</legend>
      <div className="st-rate-stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((step) => <label key={step} onMouseEnter={() => setHover(step)}>
          <input type="radio" name="rating" value={step} checked={rating === step} onChange={() => { setRating(step); setError(""); }} className="sr-only" />
          <Star size={34} fill={shown >= step ? "currentColor" : "none"} aria-hidden="true" />
          <span className="sr-only">{step} {step === 1 ? "estrella" : "estrellas"}: {ratingWords[step]}</span>
        </label>)}
      </div>
      <span className="st-rate-word" aria-live="polite">{ratingWords[shown] || "Toca las estrellas"}</span>
    </fieldset>
    <label className="st-field">
      <span>Tu comentario</span>
      <textarea id="review-body" name="body" required minLength={10} maxLength={600} rows={3} placeholder="¿Qué compraste y cómo te llegó?" />
    </label>
    <div className="st-field-row">
      <label className="st-field">
        <span>Tu nombre</span>
        <input id="review-name" name="authorName" required minLength={2} maxLength={60} autoComplete="name" placeholder="Ej.: Carolina Muñoz" />
      </label>
      <label className="st-field">
        <span>Producto (opcional)</span>
        <input id="review-product" name="productLabel" maxLength={120} list="review-products" placeholder="Ej.: Nuez cuartillo" />
        <datalist id="review-products">{products.map((name) => <option key={name} value={name} />)}</datalist>
      </label>
    </div>
    <label className="st-field">
      <span>Correo o teléfono (opcional, no se publica)</span>
      <input id="review-contact" name="contact" maxLength={120} autoComplete="email" placeholder="Para confirmar tu compra si hace falta" />
    </label>
    <label className="st-honeypot" aria-hidden="true">Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label>
    {error && <p className="st-form-error" role="alert">{error}</p>}
    <div className="st-actions">
      <button type="submit" className="st-btn st-btn-hot" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : "Enviar reseña"}</button>
      <small className="st-form-note">Publicamos tu nombre y la inicial de tu apellido.</small>
    </div>
  </form>;
}
