// src/AuthCallback.jsx — handles Google / Facebook OAuth redirects
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "./lib/LoadingScreen";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

const PROVIDER_LABELS = { google: "Google", facebook: "Facebook" };

export default function AuthCallback({ provider = "google" }) {
  const navigate = useNavigate();
  const done = useRef(false);
  const [error, setError] = useState("");
  const providerLabel = PROVIDER_LABELS[provider] || "Sign-in";

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error");
    const returnedState = params.get("state");
    const savedState = sessionStorage.getItem("oauth_state");
    sessionStorage.removeItem("oauth_state");

    if (oauthError || !code) {
      setError(oauthError === "access_denied" ? "Sign-in was cancelled." : `${providerLabel} sign-in failed. Please try again.`);
      return;
    }

    if (!returnedState || returnedState !== savedState) {
      setError("Authentication failed (state mismatch). Please try again.");
      return;
    }

    fetch(`${API_BASE}/auth/${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        redirect_uri: `https://haylingua.am/auth/${provider}/callback`,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.detail || `${providerLabel} sign-in failed`);
        }
        return res.json();
      })
      .then((data) => {
        const token = data.access_token;
        if (!token) throw new Error("No token returned");

        localStorage.setItem("access_token", token);
        localStorage.setItem("hay_token", token);

        // Store accurate user info returned by backend
        const user = {
          id: data.id,
          email: data.email || "",
          name: data.name || data.email?.split("@")[0] || "",
          username: data.username || "",
          avatarUrl: data.avatar_url || "",
          email_verified: true,
        };
        localStorage.setItem("hay_user", JSON.stringify(user));

        // Full page navigation, not React Router's navigate(): AppShell (the
        // app's top-level component) only reads localStorage into its `user`
        // state once, in a mount-only effect. A client-side navigate() here
        // lands on /dashboard while that state is still null, and /dashboard
        // is guarded by RequireOnboarded (`if (!user) return <Navigate to="/">`)
        // — so returning users got bounced straight back to the landing page
        // right after "Signing you in…". (/onboarding has no such guard, which
        // is why brand-new signups never hit this.) A full reload forces
        // AppShell to remount and read the token we just stored.
        window.location.href = data.needs_onboarding ? "/onboarding" : "/dashboard";
      })
      .catch((err) => {
        setError(err.message || "Something went wrong. Please try again.");
      });
  }, [navigate, provider, providerLabel]);

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
