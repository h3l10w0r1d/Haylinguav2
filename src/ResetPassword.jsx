import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) navigate("/", { replace: true });
  }, [token, navigate]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.detail?.errors
          ? data.detail.errors.join(" ")
          : data?.detail || "Something went wrong";
        setError(msg);
      } else {
        setDone(true);
        setTimeout(() => navigate("/", { replace: true }), 3000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <div className="mb-1 text-sm font-extrabold uppercase tracking-wide text-brand-500">Haylingua</div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Set a new password</h1>
          <p className="mt-1 text-sm text-slate-500">Choose something strong that you haven't used before.</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle className="h-12 w-12 text-grass-500" />
            <p className="font-semibold text-slate-800">Password updated!</p>
            <p className="text-sm text-slate-500">Redirecting you to log in…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-extrabold text-slate-700">New password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-2xl bg-slate-50 py-3 pl-10 pr-10 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">Min 8 chars, uppercase, lowercase, and a number.</p>
            </div>

            {error && (
              <div className="rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn3d btn3d-brand w-full uppercase disabled:opacity-60"
            >
              {loading ? "Updating…" : "Set new password"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
