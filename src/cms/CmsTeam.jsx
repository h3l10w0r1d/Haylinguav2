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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-sm text-slate-500">Haylingua CMS</div>
            <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => nav("/cms")}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50"
            >
              Back to CMS
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </div>

        {err ? (
          <div className="mb-4 text-sm bg-red-50 text-red-700 border border-red-100 rounded-xl p-3">
            {err}
          </div>
        ) : null}
        {ok ? (
          <div className="mb-4 text-sm bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl p-3">
            {ok}
          </div>
        ) : null}

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">Invite new admin</h2>
          <form onSubmit={invite} className="flex flex-col md:flex-row gap-2">
            <input
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="px-5 py-3 rounded-2xl bg-orange-600 text-white font-semibold hover:bg-orange-700">
              Send invite
            </button>
          </form>

          <div className="mt-6">
            <h2 className="font-semibold text-slate-900 mb-3">Members</h2>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
              {items.map((u) => (
                <div key={u.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{u.email}</div>
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
