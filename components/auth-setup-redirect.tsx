"use client";

import { useEffect } from "react";

export function AuthSetupRedirect() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const search = new URLSearchParams(window.location.search);
    const flowType = hash.get("type") ?? search.get("type");
    const hasImplicitSession = Boolean(hash.get("access_token") && hash.get("refresh_token"));
    const hasTokenHash = Boolean(search.get("token_hash"));
    const hasAuthError = Boolean(hash.get("error"));

    if (hasAuthError || ((flowType === "invite" || flowType === "recovery") && (hasImplicitSession || hasTokenHash))) {
      window.location.replace(`/auth/set-password${window.location.search}${window.location.hash}`);
    }
  }, []);

  return null;
}
