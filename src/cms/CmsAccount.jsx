// src/cms/CmsAccount.jsx — CMS admin account management
import { useState, useEffect } from "react";
import { Eye, EyeOff, User, Mail, Lock, Shield, Globe, CheckCircle, AlertCircle, Clock } from "lucide-react";
import CmsLayout from "./CmsLayout";
import { getCmsToken } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Amsterdam",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Europe/Yerevan",
  "Asia/Tehran",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Almaty",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
];

function cx(...a) { return a.filter(Boolean).join(" "); }

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
      <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-50">
          <Icon className="h-5 w-5 text-brand-500" />
        </div>
        <h2 className="font-display text-base font-extrabold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function StatusMsg({ ok, msg }) {
  if (!msg) return null;
  return (
    <div className={cx(
      "flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold ring-1",
      ok
        ? "bg-grass-50 text-grass-700 ring-grass-200"
        : "bg-cardinal-50 text-cardinal-700 ring-cardinal-200"
    )}>
      {ok
        ? <CheckCircle className="h-4 w-4 shrink-0" />
        : <AlertCircle className="h-4 w-4 shrink-0" />}
      {msg}
    </div>
  );
}

function PwField({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-2xl bg-slate-50 py-2.5 pl-4 pr-10 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-slate-500">{label}</label>
      {children}
    </div>
  );
}

export default function CmsAccount() {
  const token = getCmsToken();
  const [account, setAccount] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState(null);

  // Email
  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwStatus, setPwStatus] = useState(null);

  // 2FA
  const [totpCode, setTotpCode] = useState("");
  const [tfaLoading, setTfaLoading] = useState(false);
  const [tfaStatus, setTfaStatus] = useState(null);

  // Timezone
  const [timezone, setTimezone] = useState("UTC");
  const [tzLoading, setTzLoading] = useState(false);
  const [tzStatus, setTzStatus] = useState(null);

  async function call(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || `Error ${res.status}`);
    return data;
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await call("/cms/account");
        setAccount(data);
        setDisplayName(data.display_name || "");
        setTimezone(data.timezone || "UTC");
      } catch (e) {
        console.error(e);
      } finally {
        setPageLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileStatus(null);
    try {
      await call("/cms/account", {
        method: "PUT",
        body: JSON.stringify({ display_name: displayName, timezone }),
      });
      setAccount((a) => ({ ...a, display_name: displayName }));
      setProfileStatus({ ok: true, msg: "Profile saved." });
    } catch (err) {
      setProfileStatus({ ok: false, msg: err.message });
    } finally {
      setProfileLoading(false);
    }
  }

  async function saveEmail(e) {
    e.preventDefault();
    setEmailLoading(true);
    setEmailStatus(null);
    try {
      await call("/cms/account/change-email", {
        method: "POST",
        body: JSON.stringify({ new_email: newEmail, password: emailPw }),
      });
      setAccount((a) => ({ ...a, email: newEmail }));
      setEmailStatus({ ok: true, msg: "Email updated." });
      setNewEmail("");
      setEmailPw("");
    } catch (err) {
      setEmailStatus({ ok: false, msg: err.message });
    } finally {
      setEmailLoading(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwLoading(true);
    setPwStatus(null);
    try {
      await call("/cms/account/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      setPwStatus({ ok: true, msg: "Password changed." });
      setCurrentPw("");
      setNewPw("");
    } catch (err) {
      setPwStatus({ ok: false, msg: err.message });
    } finally {
      setPwLoading(false);
    }
  }

  async function disable2FA(e) {
    e.preventDefault();
    setTfaLoading(true);
    setTfaStatus(null);
    try {
      await call("/cms/account/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ code: totpCode }),
      });
      setAccount((a) => ({ ...a, totp_enabled: false }));
      setTfaStatus({ ok: true, msg: "2FA disabled. You will be required to re-enable it on next login." });
      setTotpCode("");
    } catch (err) {
      setTfaStatus({ ok: false, msg: err.message });
    } finally {
      setTfaLoading(false);
    }
  }

  async function saveTimezone(e) {
    e.preventDefault();
    setTzLoading(true);
    setTzStatus(null);
    try {
      await call("/cms/account", {
        method: "PUT",
        body: JSON.stringify({ display_name: displayName, timezone }),
      });
      setAccount((a) => ({ ...a, timezone }));
      setTzStatus({ ok: true, msg: "Timezone saved." });
    } catch (err) {
      setTzStatus({ ok: false, msg: err.message });
    } finally {
      setTzLoading(false);
    }
  }

  const initial = account?.display_name
    ? account.display_name[0].toUpperCase()
    : (account?.email?.[0] || "?").toUpperCase();

  return (
    <CmsLayout active="account" title="My Account">
      {pageLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="space-y-5">
          {/* ── Account header card ── */}
          <div className="flex items-center gap-5 rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-brand-500 text-white shadow-sm">
              <span className="font-display text-3xl font-extrabold">{initial}</span>
            </div>
            <div className="min-w-0">
              <div className="font-display text-xl font-extrabold text-slate-900">
                {account?.display_name || account?.email}
              </div>
              {account?.display_name && (
                <div className="text-sm font-semibold text-slate-500">{account?.email}</div>
              )}
              {account?.last_login_at && (
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  Last login: {new Date(account.last_login_at).toLocaleString()}
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1",
                account?.totp_enabled
                  ? "bg-grass-50 text-grass-700 ring-grass-200"
                  : "bg-cardinal-50 text-cardinal-700 ring-cardinal-200"
              )}>
                <Shield className="h-3.5 w-3.5" />
                2FA {account?.totp_enabled ? "on" : "off"}
              </span>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* ── Profile ── */}
            <Section title="Profile" icon={User}>
              <form onSubmit={saveProfile}>
                <Field label="Display name">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Armen"
                    maxLength={60}
                    autoComplete="name"
                    className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400"
                  />
                </Field>
                <div className="mt-3">
                  <StatusMsg {...(profileStatus || {})} />
                </div>
                <button
                  disabled={profileLoading}
                  className="btn3d btn3d-brand mt-3 text-sm !py-2"
                >
                  {profileLoading ? "Saving…" : "Save profile"}
                </button>
              </form>
            </Section>

            {/* ── Timezone ── */}
            <Section title="Timezone" icon={Globe}>
              <form onSubmit={saveTimezone}>
                <Field label="Your timezone">
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </Field>
                <div className="mt-3">
                  <StatusMsg {...(tzStatus || {})} />
                </div>
                <button
                  disabled={tzLoading}
                  className="btn3d btn3d-brand mt-3 text-sm !py-2"
                >
                  {tzLoading ? "Saving…" : "Save timezone"}
                </button>
              </form>
            </Section>

            {/* ── Email ── */}
            <Section title="Email address" icon={Mail}>
              <div className="rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                {account?.email}
              </div>
              <form onSubmit={saveEmail} className="space-y-3">
                <Field label="New email address">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@example.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400"
                  />
                </Field>
                <Field label="Confirm with your password">
                  <PwField
                    value={emailPw}
                    onChange={(e) => setEmailPw(e.target.value)}
                    placeholder="Current password"
                    autoComplete="current-password"
                  />
                </Field>
                <StatusMsg {...(emailStatus || {})} />
                <button
                  disabled={emailLoading}
                  className="btn3d btn3d-brand text-sm !py-2"
                >
                  {emailLoading ? "Updating…" : "Update email"}
                </button>
              </form>
            </Section>

            {/* ── Password ── */}
            <Section title="Password" icon={Lock}>
              <form onSubmit={savePassword} className="space-y-3">
                <Field label="Current password">
                  <PwField
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Current password"
                    autoComplete="current-password"
                  />
                </Field>
                <Field label="New password">
                  <PwField
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                  />
                </Field>
                <StatusMsg {...(pwStatus || {})} />
                <button
                  disabled={pwLoading}
                  className="btn3d btn3d-brand text-sm !py-2"
                >
                  {pwLoading ? "Changing…" : "Change password"}
                </button>
              </form>
            </Section>
          </div>

          {/* ── 2FA full-width ── */}
          <Section title="Two-Factor Authentication" icon={Shield}>
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex-1 min-w-[240px]">
                <div className="mb-2 flex items-center gap-2">
                  <span className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ring-1",
                    account?.totp_enabled
                      ? "bg-grass-50 text-grass-700 ring-grass-200"
                      : "bg-cardinal-50 text-cardinal-700 ring-cardinal-200"
                  )}>
                    {account?.totp_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-500">
                  {account?.totp_enabled
                    ? "2FA is active. To switch authenticator apps, disable it here then re-enable at next login."
                    : "2FA is disabled. You will be required to set it up on your next login."}
                </p>
              </div>

              {account?.totp_enabled && (
                <form onSubmit={disable2FA} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-500">
                      Enter authenticator code to disable
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="w-36 rounded-2xl bg-slate-50 px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400"
                    />
                  </div>
                  <button
                    disabled={tfaLoading || totpCode.length < 6}
                    className="btn3d btn3d-neutral text-sm !py-2"
                  >
                    {tfaLoading ? "Disabling…" : "Disable 2FA"}
                  </button>
                </form>
              )}
            </div>
            {tfaStatus?.msg && (
              <div className="mt-3">
                <StatusMsg {...tfaStatus} />
              </div>
            )}
          </Section>
        </div>
      )}
    </CmsLayout>
  );
}
