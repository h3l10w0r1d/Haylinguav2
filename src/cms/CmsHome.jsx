// src/cms/CmsHome.jsx — the CMS landing page at /cms: what needs attention
// (open exercise reports, pending affiliate applications, scheduled blog
// posts, auto-hidden exercises) and the newest learner sign-ups, each linking
// to the page that handles it. Built only from existing list endpoints —
// page_size=1 requests read just the `total`.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, BookOpen, CalendarClock, Flag, LifeBuoy, Newspaper, Percent, UserPlus,
} from "lucide-react";
import { createCmsApi, getCmsToken } from "./api";
import CmsLayout from "./CmsLayout";
import { Badge, DataTable, EmptyState, SectionCard, Skeleton, cn } from "./ui";

// Settle each request on its own so one failing endpoint doesn't blank the page.
async function settle(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (e) {
    return { ok: false, error: e?.message || "Failed to load" };
  }
}

function StatCard({ icon: Icon, label, hint, value, to, loading, error, tone }) {
  const attention = !loading && !error && Number(value) > 0;
  return (
    <Link
      to={to}
      className="group flex flex-col justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-slate-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <Icon className={cn("h-4 w-4", attention ? tone : "text-slate-300")} />
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-8 w-12" />
        ) : error ? (
          <div className="text-sm text-cardinal-600" title={error}>Couldn't load</div>
        ) : (
          <div className="text-3xl font-semibold tabular-nums text-slate-900">{Number(value || 0).toLocaleString()}</div>
        )}
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          {hint}
          <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}

const SIGNUP_COLUMNS = [
  {
    key: "email",
    header: "Learner",
    cell: (u) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-900">{u.display_name || u.username || u.email}</div>
        {(u.display_name || u.username) && <div className="truncate text-xs text-slate-500">{u.email}</div>}
      </div>
    ),
  },
  {
    key: "email_verified",
    header: "Email",
    hideBelow: "sm",
    cell: (u) => (u.email_verified ? <Badge variant="secondary">Verified</Badge> : <Badge variant="outline">Unverified</Badge>),
  },
  {
    key: "is_premium",
    header: "Plan",
    hideBelow: "sm",
    cell: (u) => (u.is_premium ? <Badge className="bg-gold-100 text-gold-800 hover:bg-gold-100">Premium</Badge> : <span className="text-slate-400">Free</span>),
  },
];

export default function CmsHome() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null);
  const [signups, setSignups] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [rep, aff, sched, mist, users] = await Promise.all([
        settle(api.listSupportReports({ status: "open", page: 1, pageSize: 5 })),
        settle(api.listAffiliates({ status: "pending", page: 1, pageSize: 1 })),
        settle(api.listBlogPosts(undefined, { status: "scheduled", page: 1, pageSize: 1 })),
        settle(api.listRepetitiveMistakes()),
        settle(api.searchSupportUsers({ page: 1, pageSize: 8 })),
      ]);
      if (!alive) return;
      const total = (r, fallbackKey) =>
        r.ok ? { value: Number(r.value?.total ?? r.value?.[fallbackKey]?.length ?? 0) } : { error: r.error };
      setStats({
        reports: total(rep, "reports"),
        affiliates: total(aff, "affiliates"),
        scheduled: total(sched, "posts"),
        mistakes: mist.ok ? { value: Number(mist.value?.count ?? mist.value?.items?.length ?? 0) } : { error: mist.error },
      });
      setReports(rep.ok ? rep.value?.reports || [] : { error: rep.error });
      setSignups(users.ok ? users.value?.users || [] : { error: users.error });
    })();
    return () => { alive = false; };
  }, [api]);

  const loading = stats === null;
  const s = stats || {};

  return (
    <CmsLayout active="home" title="Overview" description="What needs attention across Haylingua right now.">
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Flag} tone="text-cardinal-500" label="Open reports" hint="Learner-reported exercises"
            to="/cms/support?tab=reports" loading={loading} {...s.reports} />
          <StatCard icon={Percent} tone="text-brand-500" label="Pending affiliates" hint="Applications to review"
            to="/cms/affiliates?status=pending" loading={loading} {...s.affiliates} />
          <StatCard icon={CalendarClock} tone="text-feather-500" label="Scheduled posts" hint="Blog posts queued to publish"
            to="/cms/blog?status=scheduled" loading={loading} {...s.scheduled} />
          <StatCard icon={AlertTriangle} tone="text-amber-500" label="Auto-hidden exercises" hint="Repetitive mistakes to review"
            to="/cms/mistakes" loading={loading} {...s.mistakes} />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <SectionCard
            className="lg:col-span-3"
            title="Latest open reports"
            actions={<Link to="/cms/support?tab=reports" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>}
          >
            {reports === null ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : reports.error ? (
              <div className="text-sm text-cardinal-600">Couldn't load reports: {reports.error}</div>
            ) : reports.length === 0 ? (
              <EmptyState icon={Flag} tone="success" title="No open reports" description="Nothing learners have flagged is waiting." className="py-8 ring-0" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{r.exercise_prompt || `Exercise #${r.exercise_id}`}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {[r.reason, r.lesson_title].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {r.created_at && (
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">
                        {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard className="lg:col-span-2" title="Shortcuts">
            <div className="grid gap-2">
              {[
                { to: "/cms/lessons", icon: BookOpen, label: "Edit lessons" },
                { to: "/cms/blog", icon: Newspaper, label: "Write a blog post" },
                { to: "/cms/support", icon: LifeBuoy, label: "Look up a learner" },
              ].map((q) => (
                <Link key={q.to} to={q.to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                  <q.icon className="h-4 w-4 text-slate-400" />
                  <span className="flex-1">{q.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Newest sign-ups"
          actions={<Link to="/cms/support" className="text-sm font-medium text-brand-600 hover:underline">All learners</Link>}
        >
          <DataTable
            columns={SIGNUP_COLUMNS}
            rows={Array.isArray(signups) ? signups : []}
            loading={signups === null}
            error={signups?.error}
            dense
            className="shadow-none"
            onRowClick={(u) => { window.location.assign(`/cms/support?user=${u.id}`); }}
            emptyState={<EmptyState icon={UserPlus} title="No learners yet" className="py-8" />}
          />
        </SectionCard>
      </div>
    </CmsLayout>
  );
}
