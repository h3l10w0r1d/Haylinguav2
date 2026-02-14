import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function CmsInvite() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      setErr("");
      try {
        const res = await fetch(`${API_BASE}/cms/invites/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.detail || "Invalid invite");
        setEmail(data.email || "");
        setExpiresAt(data.expires_at || "");
      } catch (e) {
        setErr(String(e.message || e));
      }
    })();
  }, [token]);

  async function acceptInvite(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cms/invites/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Invite accept failed");
      const temp = data.temp_token;
      nav(`/cms/2fa-setup?temp=${encodeURIComponent(temp)}`, { replace: true });
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
          <h1 className="text-2xl font-bold text-slate-900">Accept CMS Invite</h1>
          <p className="text-slate-600 mt-1 text-sm">
            Set a password, then enable Google Authenticator.
          </p>
        </div>

        {err ? (
          <div className="mb-4 text-sm bg-red-50 text-red-700 border border-red-100 rounded-xl p-3">
            {err}
          </div>
        ) : null}

        {!token ? (
          <div className="text-sm text-slate-700">
            Open this page using the invite link (it contains a token).
          </div>
        ) : (
          <form onSubmit={acceptInvite} className="space-y-3">
            <div className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3">
              <div><span className="text-slate-500">Email:</span> {email || "…"}</div>
              {expiresAt ? (
                <div className="text-xs text-slate-500 mt-1">Expires: {expiresAt}</div>
              ) : null}
            </div>

            <input
              type="password"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <button
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors disabled:opacity-60"
            >
              Continue to 2FA setup
            </button>

            <button
              type="button"
              className="w-full py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
              onClick={() => nav("/cms/login")}
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
