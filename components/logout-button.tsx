"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton({ label = "Salir" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button className="session-button" type="button" onClick={logout} disabled={loading}>
      <LogOut size={15} />
      {loading ? "Saliendo…" : label}
    </button>
  );
}
