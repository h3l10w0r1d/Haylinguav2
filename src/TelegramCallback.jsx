// src/TelegramCallback.jsx — handles the Telegram Login Widget *redirect* flow.
// The widget is configured with data-auth-url pointing here, so on click Telegram
// navigates the whole page to this route with the signed auth data as query
// params (no popup — immune to popup blockers). We forward those params to the
// existing backend /auth/telegram endpoint, which verifies the HMAC signature.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "./lib/LoadingScreen";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function TelegramCallback() {
  const navigate = useNavigate();
  const done = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const params = new URLSearchParams(window.location.search);
    const hash = params.get("hash");
    if (!hash) {
      setError("Telegram sign-in was cancelled or returned no data.");
      return;
    }

    // Telegram appends: id, first_name, last_name, username, photo_url, auth_date, hash
    const payload = {};
    for (const [k, v] of params.entries()) payload[k] = v;
    // Backend expects id/auth_date as-is (strings are fine — it stringifies).

    fetch(`${API_BASE}/auth/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.detail || "Telegram sign-in failed");
        }
        return res.json();
      })
      .then((data) => {
        const token = data.access_token;
        if (!token) throw new Error("No token returned");

        localStorage.setItem("access_token", token);
        localStorage.setItem("hay_token", token);

        const user = {
          id: data.id ?? 1,
          email: data.email || "",
          name: data.name || data.email?.split("@")[0] || "",
          username: data.username || "",
          avatarUrl: data.avatar_url || "",
          email_verified: true,
        };
        localStorage.setItem("hay_user", JSON.stringify(user));

        navigate(data.needs_onboarding ? "/onboarding" : "/dashboard", { replace: true });
      })
      .catch((err) => {
        setError(err.message || "Something went wrong. Please try again.");
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-brand-50/50 to-white px-4">
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 shadow-sm max-w-sm w-full">
          <div className="mb-3 text-3xl">😕</div>
          <h2 className="font-display text-xl font-extrabold text-slate-800">Sign-in failed</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">{error}</p>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="mt-5 w-full rounded-2xl bg-brand-500 py-2.5 text-sm font-extrabold text-white shadow-[0_4px_0_0_#c2410c] transition active:translate-y-0.5"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return <LoadingScreen label="Signing you in…" />;
}
