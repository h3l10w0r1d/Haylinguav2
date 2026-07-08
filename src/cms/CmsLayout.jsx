// src/cms/CmsLayout.jsx
// Shared CMS app shell: a persistent left sidebar (primary navigation) + a
// sticky header with breadcrumbs, page title and a slot for page actions.
// Every CMS screen renders inside this so navigation is consistent and you
// always know where you are.
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Layers, LifeBuoy, Users, LogOut, ChevronRight, Trophy, Store, BarChart2 } from "lucide-react";

const NAV = [
  { key: "lessons", label: "Lessons", icon: BookOpen, to: "/cms" },
  { key: "chapters", label: "Chapters", icon: Layers, to: "/cms/chapters" },
  { key: "achievements", label: "Achievements", icon: Trophy, to: "/cms/achievements" },
  { key: "shop", label: "Shop & Economy", icon: Store, to: "/cms/shop" },
  { key: "analytics", label: "Analytics", icon: BarChart2, to: "/cms/analytics" },
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
    try {
      localStorage.removeItem("hay_cms_token");
    } catch {}
    navigate("/cms/login");
  }
  return (
    <button
      type="button"
      onClick={logout}
      className={cx(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-cardinal-50 hover:text-cardinal-600",
        compact ? "" : "w-full"
      )}
    >
      <LogOut className="h-5 w-5" />
      {!compact && "Log out"}
    </button>
  );
}

/**
 * Props:
 *  - active: one of NAV keys ("lessons" | "chapters" | "learners" | "team")
 *  - title: page title (string)
 *  - breadcrumb: optional array of { label, onClick? } — rendered as a trail
 *  - actions: optional node rendered on the right of the header
 *  - children: page content
 */
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
          <div className="border-t border-slate-100 pt-2">
            <LogoutButton />
          </div>
        </aside>

        {/* ---------- Main column ---------- */}
        <div className="min-w-0 flex-1">
          {/* Mobile top nav */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between">
              <Brand />
              <LogoutButton compact />
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
