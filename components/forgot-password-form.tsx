"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, MailCheck } from "lucide-react";

type ForgotPasswordResponse = { error?: string; message?: string };

export function ForgotPasswordForm({ enabled }: { enabled: boolean }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      const result = await response.json() as ForgotPasswordResponse;
      if (!response.ok) throw new Error(result.error ?? "No fue posible solicitar la recuperación.");
      setMessage(result.message ?? "Si el email está registrado, recibirás un enlace de recuperación.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible solicitar la recuperación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="recovery-email">Email</label>
        <input
          id="recovery-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={!enabled || loading}
          placeholder="nombre@empresa.cl"
        />
      </div>
      {message && <p className="form-success" role="status"><MailCheck size={18} /> {message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={!enabled || loading} style={{ width: "100%" }}>
        {loading && <LoaderCircle size={17} />} Enviar enlace de recuperación
      </button>
    </form>
  );
}
