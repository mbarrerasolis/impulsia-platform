"use client";

import { LogoutButton } from "@/components/logout-button";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="card panel admin-error" role="alert">
      <h1>No pudimos cargar esta pantalla</h1>
      <p className="muted">
        La sesión puede haber expirado o perdido sincronización. Puedes reintentar o limpiar la sesión e ingresar nuevamente.
      </p>
      <div className="admin-error-actions">
        <button className="btn btn-secondary" type="button" onClick={reset}>Reintentar</button>
        <LogoutButton label="Limpiar sesión" />
      </div>
    </section>
  );
}
