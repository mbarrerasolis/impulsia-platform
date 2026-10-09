"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function validatePassword(password: string) {
  if (password.length < 12) return "La contraseña debe tener al menos 12 caracteres.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Incluye mayúscula, minúscula, número y símbolo.";
  }
  return "";
}

export function SetPasswordForm() {
  const router = useRouter();
  const [client] = useState(() => supabaseUrl && supabaseKey ? createBrowserClient(supabaseUrl, supabaseKey) : null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function establishSession() {
      if (!client) {
        if (active) setError("Supabase no está configurado para este entorno.");
        return;
      }

      const hash = new URLSearchParams(window.location.hash.slice(1));
      const search = new URLSearchParams(window.location.search);
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const tokenHash = search.get("token_hash");
      const requestedType = search.get("type");

      const result = accessToken && refreshToken
        ? await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        : tokenHash
          ? await client.auth.verifyOtp({ token_hash: tokenHash, type: requestedType === "recovery" ? "recovery" : "invite" })
          : await client.auth.getSession();

      if (!active) return;
      if (result.error || !result.data.session) {
        setError("El enlace no es válido o expiró. Solicita un nuevo enlace de recuperación.");
        return;
      }

      window.history.replaceState({}, document.title, "/auth/set-password");
      setReady(true);
    }

    void establishSession();
    return () => { active = false; };
  }, [client]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !ready) return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    const validationError = validatePassword(password);

    if (validationError) return setError(validationError);
    if (password !== confirmation) return setError("Las contraseñas no coinciden.");

    setLoading(true);
    setError("");
    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) {
      setError("No fue posible guardar la contraseña. Solicita un nuevo enlace de recuperación.");
      setLoading(false);
      return;
    }

    router.replace("/admin/dashboard");
    router.refresh();
  }

  return <form onSubmit={submit}>
    <div className="field">
      <label htmlFor="new-password">Nueva contraseña</label>
      <input id="new-password" name="password" type="password" required minLength={12} autoComplete="new-password" disabled={!ready || loading} />
    </div>
    <div className="field">
      <label htmlFor="confirm-password">Repite la contraseña</label>
      <input id="confirm-password" name="confirmation" type="password" required minLength={12} autoComplete="new-password" disabled={!ready || loading} />
    </div>
    {!ready && !error && <p className="muted">Validando invitación…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={!ready || loading} style={{width:"100%"}}>
      {loading && <LoaderCircle size={17} />} Guardar contraseña
    </button>
  </form>;
}
