// src/MobileTelegramLogin.jsx — bare Telegram Login widget, used only by the
// mobile app's WebView-based OAuth flow (mobile/src/components/
// SocialSignInModal.js). LoginModal.jsx's widget calls a JS callback
// (window.onTelegramAuth) that doesn't survive crossing into a native
// WebView the way an in-page callback would, so this one instead uses
// data-auth-url — Telegram navigates here with signed auth data as query
// params. TelegramCallback.jsx (already registered at
// /auth/telegram/callback) does the actual token exchange and redirects to
// /dashboard or /onboarding; the mobile WebView just watches for arrival
// there and reads the token out of localStorage.
import { useEffect, useRef } from "react";

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "haylinguabot";

export default function MobileTelegramLogin() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", `${window.location.origin}/auth/telegram/callback`);
    script.setAttribute("data-request-access", "write");
    script.async = true;
    containerRef.current.appendChild(script);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f4f1] px-4">
      <p className="text-sm font-semibold text-stone-500">Tap below to continue with Telegram</p>
      <div ref={containerRef} />
    </div>
  );
}
