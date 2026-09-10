// src/cms/CmsTeam.jsx — admin team members + email-delivery diagnostics.
// Pilot page for the shared CMS kit (src/cms/ui): SectionCard/Note for the
// panels, Input/Button/Field for the forms, DataTable + SearchInput for the
// members list, and `notify` toasts instead of the old inline ok/err boxes.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Send, ShieldCheck, ShieldOff, Users } from "lucide-react";
import { createCmsApi, getCmsToken } from "./api";
import CmsLayout from "./CmsLayout";
import {
  Badge, Button, DataTable, EmptyState, Input, ListToolbar, Note, SearchInput, SectionCard,
  notify, useClientList, useListQuery,
} from "./ui";

function StatusPill({ label, ok, value }) {
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

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

const COLUMNS = [
  { key: "email", header: "Member", cell: (u) => <span className="font-extrabold text-slate-900">{u.email}</span> },
  {
    key: "status",
    header: "Status",
    cell: (u) => (
      <Badge variant={u.status === "active" ? "secondary" : "outline"} className="capitalize">{u.status || "—"}</Badge>
    ),
  },
  {
    key: "totp_enabled",
    header: "2FA",
    hideBelow: "sm",
    cell: (u) =>
      u.totp_enabled ? (
        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-grass-600"><ShieldCheck className="h-3.5 w-3.5" /> On</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-400"><ShieldOff className="h-3.5 w-3.5" /> Off</span>
      ),
  },
  { key: "last_login_at", header: "Last login", hideBelow: "md", cell: (u) => <span className="text-xs text-slate-500">{formatDate(u.last_login_at)}</span> },
];

export default function CmsTeam() {
  const nav = useNavigate();
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [mailStatus, setMailStatus] = useState(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const list = useListQuery();
  const { pageRows, total } = useClientList(items, { q: list.q, searchKeys: ["email", "status"], pageSize: Infinity });

  async function loadMembers() {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await api.listTeam();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setLoadError(e?.message || e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Per-page guard until the /cms/* auth gate lands with the shell redesign.
    if (!token) { nav("/cms/login", { replace: true }); return; }
    loadMembers();
    api.emailStatus().then(setMailStatus).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function runTest(e) {
    e.preventDefault();
    if (!testTo.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.sendTestEmail(testTo.trim());
      setTestResult(r);
      notify(r?.ok ? "Test email sent" : "Test email was not sent", r?.ok ? "ok" : "err");
      api.emailStatus().then(setMailStatus).catch(() => {});
    } catch (e2) {
      setTestResult({ ok: false, reason: "request_failed", error: String(e2.message || e2) });
      notify(e2.message || "Request failed", "err");
    } finally {
      setTesting(false);
    }
  }

  async function invite(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      await api.inviteTeam(email.trim());
      notify("Invite created — check email (or server logs if SMTP isn't configured)");
      setEmail("");
      loadMembers();
    } catch (e2) {
      notify(e2.message || "Invite failed", "err");
    } finally {
      setInviting(false);
    }
  }

  return (
    <CmsLayout active="team" title="Team" breadcrumb={[{ label: "Team" }]}>
      <div className="space-y-5">
        <SectionCard title="Email delivery" description="Invites and password resets go out through Brevo. Send yourself a test to confirm it works.">
          {mailStatus ? (
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <StatusPill label="Brevo API key" ok={mailStatus.brevo_api_key_set} />
              <StatusPill label="Verified sender" ok={!!mailStatus.sender} value={mailStatus.sender || "not set"} />
              <StatusPill label="SMTP fallback" ok={mailStatus.smtp_configured} />
              <StatusPill label="Ready to send" ok={mailStatus.ready} />
            </div>
          ) : (
            <div className="mb-4 text-sm font-semibold text-slate-500">Checking configuration…</div>
          )}

          {mailStatus && !mailStatus.ready && (
            <Note tone="brand" icon={Mail} className="mb-4">
              Email isn't configured. Set <code className="rounded bg-white/70 px-1">BREVO_API_KEY</code> and{" "}
              <code className="rounded bg-white/70 px-1">EMAIL_FROM</code> (a sender verified in your Brevo account) on the backend.
            </Note>
          )}

          <form onSubmit={runTest} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="Send a test email to…"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="flex-1"
              aria-label="Test email recipient"
            />
            <Button type="submit" variant="neutral3d" disabled={testing || !testTo.trim()}>
              <Send /> {testing ? "Sending…" : "Send test"}
            </Button>
          </form>

          {testResult && (
            <Note tone={testResult.ok ? "success" : "danger"} className="mt-3">
              {testResult.ok ? (
                <>Sent! Check the inbox (and spam).</>
              ) : (
                <>
                  Not sent — <b>{testResult.reason || "error"}</b>
                  {testResult.status ? ` (HTTP ${testResult.status})` : ""}.
                  {testResult.error && <div className="mt-1 break-words font-mono text-xs">{testResult.error}</div>}
                  {testResult.reason === "no_api_key" && <div className="mt-1 font-normal">Set BREVO_API_KEY on the backend.</div>}
                  {testResult.reason === "no_sender" && <div className="mt-1 font-normal">Set EMAIL_FROM (or BREVO_SENDER_EMAIL) to a Brevo-verified sender.</div>}
                </>
              )}
            </Note>
          )}
        </SectionCard>

        <SectionCard title="Invite an admin" description="They'll get an email with a link to set up their account.">
          <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="colleague@haylingua.am"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              aria-label="Email address to invite"
            />
            <Button type="submit" variant="brand3d" disabled={inviting || !email.trim()}>
              {inviting ? "Sending…" : "Send invite"}
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Members">
          <ListToolbar
            search={<SearchInput value={list.q} onChange={(q) => list.set({ q })} placeholder="Search members…" />}
            count={total}
            countLabel="member"
          />
          <DataTable
            columns={COLUMNS}
            rows={pageRows}
            loading={loading}
            error={loadError}
            onRetry={loadMembers}
            dense
            emptyState={
              <EmptyState
                icon={Users}
                title={list.q ? "No members match" : "No members yet"}
                description={list.q ? "Try a different search." : "Invite a colleague above to get started."}
                action={list.q ? <Button variant="outline" size="sm" onClick={() => list.set({ q: "" })}>Clear search</Button> : null}
              />
            }
          />
        </SectionCard>
      </div>
    </CmsLayout>
  );
}
