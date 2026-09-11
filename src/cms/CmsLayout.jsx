// src/cms/CmsLayout.jsx — the admin CMS shell: grouped sidebar, header with
// breadcrumb/title/actions, mobile sheet nav, ⌘K page palette, and the
// providers every page needs (confirm dialogs, toasts, tooltips).
//
// Props contract is unchanged for existing callers (the CRM pages import
// this): `active` (a NAV key; unknown keys such as "account" simply
// highlight nothing), `title`, `breadcrumb` ([{ label, onClick? }] — items
// may now also carry `to`), `actions`, `children`. New, optional:
// `description`, `wide`, `contentClassName`.
//
// Light-only by decision: the CMS strips the app's `dark` class on <html>
// while mounted and restores the saved theme on unmount.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle, BarChart2, BookOpen, Briefcase, ChevronDown, Crown, FlaskConical, Home, Layers,
  LifeBuoy, LogOut, Map as MapIcon, Menu, MessagesSquare, Mic, Mic2, Newspaper, Percent,
  Search, Settings, Sparkles, Store, Trophy, Type, Users, UsersRound, Zap,
} from "lucide-react";
import { createCmsApi, getCmsToken } from "./api";
import { applyTheme, getTheme } from "../lib/theme";
import "./cms.css";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "./ui/ConfirmDialog";
import { cn } from "@/lib/utils";

// Keys and paths are unchanged from the old flat list — only the grouping
// is new. `active` props across the codebase keep working as-is.
export const NAV_GROUPS = [
  {
    key: "overview",
    label: "Overview",
    items: [{ key: "home", label: "Home", icon: Home, to: "/cms" }],
  },
  {
    key: "content",
    label: "Content",
    items: [
      { key: "lessons", label: "Lessons", icon: BookOpen, to: "/cms/lessons" },
      { key: "chapters", label: "Chapters", icon: Layers, to: "/cms/chapters" },
      { key: "adventures", label: "Adventures", icon: MapIcon, to: "/cms/adventures" },
      { key: "letter-audio", label: "Letter Audio", icon: Type, to: "/cms/letter-audio" },
    ],
  },
  {
    key: "engagement",
    label: "Engagement",
    items: [
      { key: "achievements", label: "Achievements", icon: Trophy, to: "/cms/achievements" },
      { key: "shop", label: "Shop & Economy", icon: Store, to: "/cms/shop" },
      { key: "items", label: "Marketplace Items", icon: Sparkles, to: "/cms/items" },
      { key: "premium", label: "Premium Plans", icon: Crown, to: "/cms/premium" },
    ],
  },
  {
    key: "growth",
    label: "Growth",
    items: [
      { key: "blog", label: "Blog", icon: Newspaper, to: "/cms/blog" },
      { key: "careers", label: "Careers", icon: Briefcase, to: "/cms/careers" },
      { key: "affiliates", label: "Affiliates", icon: Percent, to: "/cms/affiliates" },
      { key: "forum", label: "Community", icon: MessagesSquare, to: "/cms/forum" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    items: [
      { key: "automations", label: "Automations", icon: Zap, to: "/cms/automations" },
      { key: "segments", label: "Segments", icon: UsersRound, to: "/cms/segments" },
    ],
  },
  {
    key: "insights",
    label: "Insights",
    items: [
      { key: "analytics", label: "Analytics", icon: BarChart2, to: "/cms/analytics" },
      { key: "mistakes", label: "Repetitive mistakes", icon: AlertTriangle, to: "/cms/mistakes" },
    ],
  },
  {
    key: "labs",
    label: "Labs",
    items: [
      { key: "exercise-lab", label: "Exercise Lab", icon: FlaskConical, to: "/cms/exercise-lab" },
      { key: "voice-lab", label: "Voice Lab", icon: Mic2, to: "/cms/voice-lab" },
      { key: "stt-lab", label: "STT Lab", icon: Mic, to: "/cms/stt-lab" },
    ],
  },
  {
    key: "people",
    label: "People",
    items: [
      { key: "learners", label: "Learners", icon: LifeBuoy, to: "/cms/support" },
      { key: "team", label: "Team", icon: Users, to: "/cms/team" },
    ],
  },
];
export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const NAV_OPEN_KEY = "hay_cms_nav_open";
function readOpenGroups() {
  try {
    const v = JSON.parse(localStorage.getItem(NAV_OPEN_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function Brand({ compact = false }) {
  return (
    <Link to="/cms" className="flex items-center gap-3 px-2 py-1">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500 text-white shadow-sm ring-1 ring-brand-600/20">
        <span className="font-display text-lg font-extrabold">Հ</span>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-sm font-bold text-slate-900">Haylingua</div>
          <div className="-mt-0.5 text-xs font-semibold text-slate-500">Content Studio</div>
        </div>
      )}
    </Link>
  );
}

function NavItem({ item, active, onNavigate }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand-500" : "text-slate-400")} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function GroupedNav({ active, onNavigate }) {
  const [open, setOpen] = useState(readOpenGroups);
  const activeGroup = useMemo(() => NAV_GROUPS.find((g) => g.items.some((i) => i.key === active))?.key, [active]);

  function toggle(key, next) {
    setOpen((prev) => {
      const v = { ...prev, [key]: next };
      try { localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(v)); } catch {}
      return v;
    });
  }

  return (
    <nav className="space-y-4" aria-label="CMS sections">
      {NAV_GROUPS.map((group) => {
        // Default open; the group holding the current page can't be collapsed away.
        const isOpen = group.key === activeGroup || open[group.key] !== false;
        return (
          <Collapsible key={group.key} open={isOpen} onOpenChange={(v) => toggle(group.key, v)}>
            <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-400 hover:text-slate-600">
              {group.label}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.key} item={item} active={item.key === active} onNavigate={onNavigate} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
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
      aria-label="Log out"
      className={cn(
        "flex items-center gap-2 rounded-xl p-2 text-slate-400 transition hover:bg-cardinal-50 hover:text-cardinal-600",
        !compact && "w-full gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-600"
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
    createCmsApi(token).getAccount().then((d) => d && setAccount(d)).catch(() => {});
  }, []);

  const initial = (account?.display_name || account?.email || "?")[0].toUpperCase();
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
        aria-label="Account settings"
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-xl transition",
          isAccountPage ? "bg-brand-100 text-brand-600" : "text-slate-400 hover:bg-white hover:text-brand-600"
        )}
      >
        <Settings className="h-4 w-4" />
      </Link>
      <LogoutButton compact />
    </div>
  );
}

// ⌘K / Ctrl+K page palette over every nav item.
function PagePalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a CMS page…" />
      <CommandList>
        <CommandEmpty>No page matches.</CommandEmpty>
        {NAV_GROUPS.map((group) => (
          <CommandGroup key={group.key} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.key}
                value={`${group.label} ${item.label}`}
                onSelect={() => { onOpenChange(false); navigate(item.to); }}
              >
                <item.icon className="mr-2 h-4 w-4 text-slate-400" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

function useForceLight() {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      if (wasDark && getTheme() === "dark") applyTheme("dark");
    };
  }, []);
}

function useCommandK(setOpen) {
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

function Crumbs({ breadcrumb }) {
  if (!breadcrumb?.length) return null;
  return (
    <Breadcrumb className="mb-0.5">
      <BreadcrumbList className="text-xs font-bold">
        {breadcrumb.map((b, i) => {
          const last = i === breadcrumb.length - 1;
          return (
            <span key={i} className="contents">
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage className="text-slate-600">{b.label}</BreadcrumbPage>
                ) : b.to ? (
                  <BreadcrumbLink asChild><Link to={b.to}>{b.label}</Link></BreadcrumbLink>
                ) : b.onClick ? (
                  <BreadcrumbLink asChild>
                    <button type="button" onClick={b.onClick}>{b.label}</button>
                  </BreadcrumbLink>
                ) : (
                  <span>{b.label}</span>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function CmsLayout({
  active,
  title,
  breadcrumb = [],
  actions = null,
  description,
  wide = false,
  contentClassName,
  children,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  useForceLight();
  useCommandK(setPaletteOpen);

  return (
    <TooltipProvider delayDuration={300}>
      <ConfirmProvider>
        <div className="cms-root min-h-screen bg-slate-50 text-slate-900">
          <div className="flex">
            {/* ---------- Sidebar (desktop) ---------- */}
            <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
              <div className="px-3 pt-4">
                <Brand />
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="mt-4 flex w-full items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-400 ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-600"
                >
                  <Search className="h-4 w-4" />
                  <span className="flex-1">Jump to…</span>
                  <kbd className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-400 ring-1 ring-slate-200">⌘K</kbd>
                </button>
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                <GroupedNav active={active} />
              </div>
              <div className="border-t border-slate-100 p-3">
                <UserCard />
              </div>
            </aside>

            {/* ---------- Main column ---------- */}
            <div className="min-w-0 flex-1">
              {/* Mobile top bar */}
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur lg:hidden">
                <Brand />
                <div className="flex items-center gap-1">
                  <Link to="/cms/account" aria-label="Account settings" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-brand-600">
                    <Settings className="h-4 w-4" />
                  </Link>
                  <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Open navigation">
                        <Menu />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[18rem] overflow-y-auto p-4">
                      <SheetTitle className="sr-only">CMS navigation</SheetTitle>
                      <Brand />
                      <div className="mt-5">
                        <GroupedNav active={active} onNavigate={() => setSheetOpen(false)} />
                      </div>
                      <div className="mt-6 border-t border-slate-100 pt-3">
                        <UserCard />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>

              {/* Header */}
              <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
                <div className={cn("mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-8", wide ? "max-w-7xl" : "max-w-6xl")}>
                  <div className="min-w-0">
                    <Crumbs breadcrumb={breadcrumb} />
                    <h1 className="truncate text-xl font-semibold text-slate-900">{title}</h1>
                    {description && <p className="mt-0.5 text-sm font-semibold text-slate-500">{description}</p>}
                  </div>
                  {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
                </div>
              </header>

              {/* Content */}
              <main className={cn("mx-auto px-4 py-6 lg:px-8", wide ? "max-w-7xl" : "max-w-6xl", contentClassName)}>
                {children}
              </main>
            </div>
          </div>

          <PagePalette open={paletteOpen} onOpenChange={setPaletteOpen} />
          <Toaster position="bottom-center" richColors closeButton />
        </div>
      </ConfirmProvider>
    </TooltipProvider>
  );
}
