"use client";

import { useEffect, useRef, useState } from "react";

// Cloudflare Turnstile widget for the auth forms. Supabase verifies the token
// server-side (Auth → Attack Protection), so this component is only responsible
// for producing one — a bot that strips it out gets rejected by Supabase, not here.
//
// With no NEXT_PUBLIC_TURNSTILE_SITE_KEY the widget renders nothing and reports a
// null token, which keeps local dev and preview deploys usable. That is safe for
// the same reason: enforcement lives in Supabase, not in this file.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
        theme?: "light" | "dark" | "auto";
      }) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function loadScript() {
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
  const script = document.createElement("script");
  script.src = SCRIPT_SRC;
  script.async = true;
  document.head.appendChild(script);
}

/**
 * Renders the widget and hands the parent a token. `resetKey` exists because
 * Turnstile tokens are single-use: after a rejected submit the old token is
 * spent, so the parent bumps resetKey to mint a fresh one. Without that, a user
 * who mistypes their password can never submit again.
 */
export function Turnstile({ onToken, resetKey = 0 }: {
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    loadScript();
    const timer = setInterval(() => {
      if (window.turnstile) { setReady(true); clearInterval(timer); }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready || !TURNSTILE_SITE_KEY || !ref.current || !window.turnstile) return;
    const el = ref.current;
    widgetId.current = window.turnstile.render(el, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
      theme: "auto",
    });
    const id = widgetId.current;
    return () => {
      if (id) window.turnstile?.remove(id);
      widgetId.current = null;
    };
    // onToken is a fresh closure each render; re-registering the widget on every
    // keystroke would reset the challenge, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} style={{ minHeight: 65 }} />;
}
