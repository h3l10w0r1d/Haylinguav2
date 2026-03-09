import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function CmsLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("password"); // password | totp | setup
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitPassword(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cms/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Login failed");
      setTempToken(data.temp_token || "");
      if (data.needs_2fa_setup) setStage("setup");
      else setStage("totp");
    } catch (e2) {
      setErr(String(e2.message || e2));
    } finally {
      setLoading(false);
    }
  }

  async function submitTotp(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cms/auth/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_token: tempToken, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "2FA failed");
      localStorage.setItem("hay_cms_token", data.access_token);
      nav("/cms", { replace: true });
    } catch (e2) {
      setErr(String(e2.message || e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
        <div className="mb-5">
          <div className="text-sm text-slate-500">Haylingua</div>
          <h1 className="text-2xl font-bold text-slate-900">CMS Login</h1>
          <p className="text-slate-600 mt-1 text-sm">
            Invite-only. Password + Google Authenticator required.
          </p>
        </div>

        {err ? (
          <div className="mb-4 text-sm bg-red-50 text-red-700 border border-red-100 rounded-xl p-3">
            {err}
          </div>
        ) : null}

        {stage === "password" ? (
          <form onSubmit={submitPassword} className="space-y-3">
            <input
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              type="password"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60"
            >
              Continue
            </button>

            <button
              type="button"
              className="w-full py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
              onClick={() => nav("/cms/invite")}
            >
              I have an invite link
            </button>
          </form>
        ) : null}

        {stage === "setup" ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
              Your account must enable 2FA before login. Continue setup.
            </div>
            <button
              className="w-full py-3 rounded-2xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors"
              onClick={() => nav(`/cms/2fa-setup?temp=${encodeURIComponent(tempToken)}`)}
            >
              Setup 2FA
            </button>
          </div>
        ) : null}

        {stage === "totp" ? (
          <form onSubmit={submitTotp} className="space-y-3">
            <input
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
            />
            <button
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60"
            >
              Verify & enter CMS
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
