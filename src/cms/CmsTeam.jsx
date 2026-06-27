import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCmsApi, getCmsToken } from "./api";

export default function CmsTeam() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
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
    })();
  }, [token]);

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

  function logout() {
    localStorage.removeItem("hay_cms_token");
    nav("/cms/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-white font-display text-lg font-extrabold">
              H
            </div>
            <div>
              <div className="text-sm font-extrabold text-brand-600">Haylingua CMS</div>
              <h1 className="font-display text-2xl font-extrabold text-slate-900">Team</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => nav("/cms")}
              className="btn3d btn3d-neutral text-sm"
            >
              Back to CMS
            </button>
            <button
              onClick={logout}
              className="btn3d btn3d-cardinal text-sm"
            >
              Log out
            </button>
          </div>
        </div>

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
      </div>
    </div>
  );
}
