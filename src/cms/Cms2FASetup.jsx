import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function Cms2FASetup() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const temp = sp.get("temp") || "";

  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!temp) return;
      setErr("");
      try {
        const res = await fetch(`${API_BASE}/cms/2fa/setup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${temp}`,
          },
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.detail || "2FA setup failed");
        setSecret(data.secret || "");
        setOtpauth(data.otpauth_url || "");
        setQr(data.qr_data_url || "");
      } catch (e) {
        setErr(String(e.message || e));
      }
    })();
  }, [temp]);

  async function confirm(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cms/2fa/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${temp}`,
        },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "2FA confirm failed");
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
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
        <div className="mb-5">
          <div className="text-sm text-slate-500">Haylingua</div>
          <h1 className="text-2xl font-bold text-slate-900">Enable 2FA</h1>
          <p className="text-slate-600 mt-1 text-sm">
            Scan the secret in Google Authenticator, then enter the 6-digit code.
          </p>
        </div>

        {err ? (
          <div className="mb-4 text-sm bg-red-50 text-red-700 border border-red-100 rounded-xl p-3">
            {err}
          </div>
        ) : null}

        {!temp ? (
          <div className="text-sm text-slate-700">
            Missing temp token. Open this page from invite flow or login.
          </div>
        ) : (
          <>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="text-sm font-semibold text-slate-900 mb-2">
                Add account in Google Authenticator
              </div>

              {qr ? (
                <div className="flex items-center justify-center mb-3">
                  <img
                    src={qr}
                    alt="2FA QR"
                    className="w-48 h-48 rounded-2xl border border-slate-200 bg-white"
                  />
                </div>
              ) : null}

              <div className="text-sm text-slate-700">
                <div className="mb-2">
                  <span className="text-slate-500">Secret:</span>{" "}
                  <code className="px-2 py-1 rounded bg-white border border-slate-200">
                    {secret || "…"}
                  </code>
                </div>
                <div className="text-xs text-slate-500 break-all">
                  If you need it: {otpauth || "…"}
                </div>
              </div>
            </div>

            <form onSubmit={confirm} className="mt-4 space-y-3">
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
                Confirm 2FA & enter CMS
              </button>

              <button
                type="button"
                className="w-full py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
                onClick={() => nav("/cms/login")}
              >
                Back to login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
