"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

type Turnstile = {
  render(container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void; language?: string }): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window { turnstile?: Turnstile }
}

/**
 * Widget de Cloudflare Turnstile con render explícito: `onReady` vuelve a montarlo tras cada
 * navegación del lado del cliente. `resetKey` distinto obliga a pedir un token nuevo (cada token sirve una vez).
 */
export function TurnstileWidget({ siteKey, onToken, resetKey }: { siteKey: string; onToken: (token: string) => void; resetKey: number }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; });

  function mount() {
    if (!window.turnstile || !container.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      language: "es",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(""),
      "error-callback": () => onTokenRef.current("")
    });
  }

  useEffect(() => () => {
    if (widgetId.current) window.turnstile?.remove(widgetId.current);
    widgetId.current = undefined;
  }, []);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) {
      onTokenRef.current("");
      window.turnstile?.reset(widgetId.current);
    }
  }, [resetKey]);

  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={mount}/>
    <div ref={container} className="turnstile-slot"/>
  </>;
}
