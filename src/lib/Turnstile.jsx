// src/lib/Turnstile.jsx
// Cloudflare Turnstile widget wrapper.
// Renders the Turnstile challenge and calls onVerify(token) on success.

import { useEffect, useRef } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

export default function Turnstile({ onVerify }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    function render() {
      if (!isMounted) return;
      if (!containerRef.current) return;
      if (!window.turnstile) return;
      if (widgetIdRef.current !== null) return; // already rendered

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => {
            if (isMounted) onVerify?.(token);
          },
          "expired-callback": () => {
            if (isMounted) onVerify?.(null);
          },
          "error-callback": () => {
            if (isMounted) onVerify?.(null);
          },
        });
      } catch (e) {
        console.warn("[Turnstile] render error:", e);
      }
    }

    // If the Turnstile script is already loaded, render immediately.
    if (window.turnstile) {
      render();
    } else {
      // Inject the script once, then render on load.
      const existing = document.getElementById("cf-turnstile-script");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.onload = render;
        document.head.appendChild(script);
      } else {
        // Script tag exists but may not have fired onload yet; poll briefly.
        const interval = setInterval(() => {
          if (window.turnstile) {
            clearInterval(interval);
            render();
          }
        }, 100);
        return () => {
          clearInterval(interval);
          isMounted = false;
        };
      }
    }

    return () => {
      isMounted = false;
      try {
        if (widgetIdRef.current !== null && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      } catch {
        // ignore
      }
    };
  }, []);

  return <div ref={containerRef} />;
}
