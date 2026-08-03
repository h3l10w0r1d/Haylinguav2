// src/cms/CmsLayout.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { BookOpen, Layers, LifeBuoy, Users, LogOut, ChevronRight, Trophy, Store, BarChart2, Settings, Shield, Mic2, Mic, Crown, Briefcase, MessagesSquare, Percent, Type, AlertTriangle, FlaskConical, Map as MapIcon, Sparkles } from "lucide-react";
import { getCmsToken } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

const NAV = [
  { key: "lessons", label: "Lessons", icon: BookOpen, to: "/cms" },
  { key: "chapters", label: "Chapters", icon: Layers, to: "/cms/chapters" },
  { key: "adventures", label: "Adventures", icon: MapIcon, to: "/cms/adventures" },
  { key: "achievements", label: "Achievements", icon: Trophy, to: "/cms/achievements" },
  { key: "shop", label: "Shop & Economy", icon: Store, to: "/cms/shop" },
  { key: "items", label: "Marketplace Items", icon: Sparkles, to: "/cms/items" },
  { key: "premium", label: "Premium Plans", icon: Crown, to: "/cms/premium" },
  { key: "careers", label: "Careers", icon: Briefcase, to: "/cms/careers" },
  { key: "affiliates", label: "Affiliates", icon: Percent, to: "/cms/affiliates" },
  { key: "forum", label: "Community", icon: MessagesSquare, to: "/cms/forum" },
  { key: "analytics", label: "Analytics", icon: BarChart2, to: "/cms/analytics" },
  { key: "mistakes", label: "Repetitive mistakes", icon: AlertTriangle, to: "/cms/mistakes" },
  { key: "exercise-lab", label: "Exercise Lab", icon: FlaskConical, to: "/cms/exercise-lab" },
  { key: "voice-lab", label: "Voice Lab", icon: Mic2, to: "/cms/voice-lab" },
  { key: "stt-lab", label: "STT Lab", icon: Mic, to: "/cms/stt-lab" },
  { key: "letter-audio", label: "Letter Audio", icon: Type, to: "/cms/letter-audio" },
  { key: "learners", label: "Learners", icon: LifeBuoy, to: "/cms/support" },
  { key: "team", label: "Team", icon: Users, to: "/cms/team" },
];

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function Brand() {
  return (
    <Link to="/cms" className="flex items-center gap-3 px-2 py-1">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500 text-white shadow-sm ring-1 ring-brand-600/20">
        <span className="font-display text-lg font-extrabold">Հ</span>
      </div>
      <div className="leading-tight">
        <div className="font-display text-sm font-bold text-slate-900">Haylingua</div>
        <div className="-mt-0.5 text-xs font-semibold text-slate-500">Content Studio</div>
      </div>
    </Link>
  );
}

function NavItem({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cx(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition",
        active
          ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
          : "text-slate-600 hover:bg-slate-100"
      )}
    >
      <Icon className={cx("h-5 w-5", active ? "text-brand-500" : "text-slate-400")} />
      {item.label}
    </Link>
  );
}

function LogoutButton({ compact }) {
  const navigate = useNavigate();
  function logout() {
    try { localStorage.removeItem("hay_cms_token"); } catch {}
    navigate("/cms/login");
  }
  return (
    <button
      type="button"
      onClick={logout}
      title="Log out"
      className={cx(
        "flex items-center gap-2 rounded-xl p-2 text-slate-400 transition hover:bg-cardinal-50 hover:text-cardinal-600",
        compact ? "" : "w-full px-3 py-2.5 text-sm font-bold text-slate-600 gap-3 rounded-2xl"
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {!compact && "Log out"}
    </button>
  );
}

function UserCard() {
  const [account, setAccount] = useState(null);
  const location = useLocation();
  const isAccountPage = location.pathname === "/cms/account";

  useEffect(() => {
    const token = getCmsToken();
    if (!token) return;
    fetch(`${API_BASE}/cms/account`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setAccount(data))
      .catch(() => {});
  }, []);

  const initial = account?.display_name
    ? account.display_name[0].toUpperCase()
    : (account?.email?.[0] || "?").toUpperCase();

  const label = account?.display_name || account?.email || "My account";
  const sub = account?.display_name && account?.email ? account.email : null;

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-100">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500 text-white shadow-sm">
        <span className="font-display text-sm font-extrabold">{initial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold text-slate-800">{label}</div>
        {sub && <div className="truncate text-[10px] font-semibold text-slate-400">{sub}</div>}
      </div>
      <Link
        to="/cms/account"
        title="Account settings"
        className={cx(
          "grid h-7 w-7 shrink-0 place-items-center rounded-xl transition",
          isAccountPage
            ? "bg-brand-100 text-brand-600"
            : "text-slate-400 hover:bg-white hover:text-brand-600"
        )}
      >
        <Settings className="h-4 w-4" />
      </Link>
      <LogoutButton compact />
    </div>
  );
}

export default function CmsLayout({ active, title, breadcrumb = [], actions = null, children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        {/* ---------- Sidebar (desktop) ---------- */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 lg:flex">
          <Brand />
          <nav className="mt-6 space-y-1">
            {NAV.map((item) => (
              <NavItem key={item.key} item={item} active={item.key === active} />
            ))}
          </nav>
          <div className="flex-1" />
          <div className="border-t border-slate-100 pt-3">
            <UserCard />
          </div>
        </aside>

        {/* ---------- Main column ---------- */}
        <div className="min-w-0 flex-1">
          {/* Mobile top nav */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between">
              <Brand />
              <div className="flex items-center gap-1">
                <Link to="/cms/account" className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition">
                  <Settings className="h-4 w-4" />
                </Link>
                <LogoutButton compact />
              </div>
            </div>
            <nav className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                const on = item.key === active;
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={cx(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition",
                      on ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Header */}
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur lg:top-0">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-8">
              <div className="min-w-0">
                {breadcrumb.length > 0 && (
                  <div className="mb-0.5 flex items-center gap-1 text-xs font-bold text-slate-400">
                    {breadcrumb.map((b, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
                        {b.onClick ? (
                          <button
                            type="button"
                            onClick={b.onClick}
                            className="rounded px-0.5 transition hover:text-brand-600"
                          >
                            {b.label}
                          </button>
                        ) : (
                          <span className={i === breadcrumb.length - 1 ? "text-slate-600" : ""}>{b.label}</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                <h1 className="truncate font-display text-xl font-extrabold text-slate-900">{title}</h1>
              </div>
              {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            </div>
          </header>

          {/* Content */}
          <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
