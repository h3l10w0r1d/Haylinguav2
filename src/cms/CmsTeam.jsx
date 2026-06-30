import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCmsApi, getCmsToken } from "./api";
import CmsLayout from "./CmsLayout";

function Pill({ label, ok, value }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <span className={"inline-flex items-center gap-1.5 text-xs font-extrabold " + (ok ? "text-grass-600" : "text-cardinal-500")}>
        <span className={"h-2 w-2 rounded-full " + (ok ? "bg-grass-500" : "bg-cardinal-400")} />
        {value || (ok ? "OK" : "missing")}
      </span>
    </div>
  );
}

export default function CmsTeam() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [mailStatus, setMailStatus] = useState(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const token = getCmsToken();
  const api = createCmsApi(token);

  useEffect(() => {
    (async () => {
      if (!token) return nav("/cms/login", { replace: true });
      setErr("");
      try {
        const rows = await api.listTeam();
        setItems(rows || []);
      } catch (e) {
        setErr(String(e.message || e));
      }
      try {
        setMailStatus(await api.emailStatus());
      } catch {}
    })();
  }, [token]);

  async function runTest(e) {
    e.preventDefault();
    if (!testTo.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.sendTestEmail(testTo.trim());
      setTestResult(r);
      try {
        setMailStatus(await api.emailStatus());
      } catch {}
    } catch (e2) {
      setTestResult({ ok: false, reason: "request_failed", error: String(e2.message || e2) });
    } finally {
      setTesting(false);
    }
  }

  async function invite(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    try {
      await api.inviteTeam(email);
      setOk("Invite created. Check email (or server logs if SMTP is not configured).");
      setEmail("");
    } catch (e2) {
      setErr(String(e2.message || e2));
    }
  }

  return (
    <CmsLayout active="team" title="Team">
      {err ? (
        <div className="mb-4 text-sm bg-cardinal-50 text-cardinal-700 ring-1 ring-cardinal-100 rounded-2xl p-3">
          {err}
        </div>
      ) : null}
      {ok ? (
        <div className="mb-4 text-sm bg-grass-50 text-grass-700 ring-1 ring-grass-100 rounded-2xl p-3">
          {ok}
        </div>
      ) : null}

      {/* Email delivery diagnostics */}
      <div className="mb-4 rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-slate-900 mb-3">Email delivery</h2>
        {mailStatus ? (
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <Pill label="Brevo API key" ok={mailStatus.brevo_api_key_set} />
            <Pill label="Verified sender" ok={!!mailStatus.sender} value={mailStatus.sender || "not set"} />
            <Pill label="SMTP fallback" ok={mailStatus.smtp_configured} />
            <Pill label="Ready to send" ok={mailStatus.ready} />
          </div>
        ) : (
          <div className="mb-4 text-sm text-slate-500">Checking configuration…</div>
        )}

        {mailStatus && !mailStatus.ready ? (
          <div className="mb-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
            Email isn’t configured. Set <code className="rounded bg-white/70 px-1">BREVO_API_KEY</code> and{" "}
            <code className="rounded bg-white/70 px-1">EMAIL_FROM</code> (a sender verified in your Brevo account) on the backend.
          </div>
        ) : null}

        <form onSubmit={runTest} className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-2xl bg-slate-50 px-4 py-2.5 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
            placeholder="Send a test email to…"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button className="btn3d btn3d-neutral text-sm" disabled={testing}>
            {testing ? "Sending…" : "Send test"}
          </button>
        </form>

        {testResult ? (
          <div
            className={
              "mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 " +
              (testResult.ok ? "bg-grass-50 text-grass-700 ring-grass-200" : "bg-cardinal-50 text-cardinal-700 ring-cardinal-100")
            }
          >
            {testResult.ok ? (
              <>✅ Sent! Check the inbox (and spam).</>
            ) : (
              <>
                ❌ Not sent — <b>{testResult.reason || "error"}</b>
                {testResult.status ? ` (HTTP ${testResult.status})` : ""}.
                {testResult.error ? <div className="mt-1 break-words font-mono text-xs text-cardinal-600">{testResult.error}</div> : null}
                {testResult.reason === "no_api_key" ? <div className="mt-1 font-normal">Set BREVO_API_KEY on the backend.</div> : null}
                {testResult.reason === "no_sender" ? <div className="mt-1 font-normal">Set EMAIL_FROM (or BREVO_SENDER_EMAIL) to a Brevo-verified sender.</div> : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-slate-900 mb-3">Invite new admin</h2>
        <form onSubmit={invite} className="flex flex-col md:flex-row gap-2">
          <input
            className="flex-1 rounded-2xl bg-slate-50 px-4 py-2.5 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn3d btn3d-brand text-sm">
            Send invite
          </button>
        </form>

        <div className="mt-6">
          <h2 className="font-display text-lg font-extrabold text-slate-900 mb-3">Members</h2>
          <div className="divide-y divide-slate-100 ring-1 ring-slate-200 rounded-2xl overflow-hidden">
            {items.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-900">{u.email}</div>
                  <div className="text-xs text-slate-500">
                    status: {u.status} · 2FA: {u.totp_enabled ? "enabled" : "off"}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  last login: {u.last_login_at ? String(u.last_login_at) : "—"}
                </div>
              </div>
            ))}
            {items.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No users found.</div>
            ) : null}
          </div>
        </div>
      </div>
    </CmsLayout>
  );
}
