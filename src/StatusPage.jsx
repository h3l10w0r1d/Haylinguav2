// src/StatusPage.jsx — public status page. No auth, no header/nav chrome.
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Loader2, ArrowLeft } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const REFRESH_MS = 60_000;

const STATUS_META = {
  operational: { label: "Operational", dot: "bg-grass-500", text: "text-grass-700", bg: "bg-grass-50", ring: "ring-grass-200", Icon: CheckCircle2 },
  degraded: { label: "Degraded performance", dot: "bg-gold-500", text: "text-gold-600", bg: "bg-gold-50", ring: "ring-gold-100", Icon: AlertTriangle },
  down: { label: "Down", dot: "bg-cardinal-500", text: "text-cardinal-600", bg: "bg-cardinal-50", ring: "ring-cardinal-100", Icon: XCircle },
  unknown: { label: "No data yet", dot: "bg-slate-300", text: "text-slate-500", bg: "bg-slate-50", ring: "ring-slate-200", Icon: HelpCircle },
};

function metaFor(status) {
  return STATUS_META[status] || STATUS_META.unknown;
}

function OverallBanner({ overall }) {
  const m = metaFor(overall);
  const copy =
    overall === "operational"
      ? "All systems operational"
      : overall === "degraded"
      ? "Some systems experiencing issues"
      : overall === "down"
      ? "Major service disruption"
      : "Monitoring is starting up";
  return (
    <div className={"flex items-center gap-3 rounded-3xl p-5 ring-1 " + m.bg + " " + m.ring}>
      <m.Icon className={"h-7 w-7 shrink-0 " + m.text} />
      <div className={"font-display text-lg font-extrabold " + m.text}>{copy}</div>
    </div>
  );
}

function DayBars({ days }) {
  return (
    <div className="flex items-end gap-[3px]">
      {days.map((d) => {
        const m = metaFor(d.status === "no_data" ? "unknown" : d.status);
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.status === "no_data" ? "no data" : metaFor(d.status).label}`}
            className={"h-6 w-1.5 rounded-full sm:w-2 " + m.dot + (d.status === "no_data" ? " opacity-40" : "")}
          />
        );
      })}
    </div>
  );
}

function ServiceRow({ service }) {
  const m = metaFor(service.status);
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + m.dot} />
          <span className="font-display text-base font-extrabold text-slate-800">{service.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {service.latency_ms != null && (
            <span className="text-xs font-bold text-slate-400 tabular-nums">{service.latency_ms}ms</span>
          )}
          <span className={"rounded-full px-2.5 py-1 text-xs font-extrabold " + m.bg + " " + m.text}>{m.label}</span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <DayBars days={service.days} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400">
        <span>30 days ago</span>
        <span>
          {service.uptime_pct_30d != null ? `${service.uptime_pct_30d}% uptime` : "No data yet"}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

export default function StatusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const load = () => {
    fetch(`${API_BASE}/status`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch(() => setError("Couldn't load status right now."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-500 hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Haylingua
        </Link>

        <h1 className="font-display text-2xl font-extrabold text-slate-800">System status</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Live health of Haylingua's services, checked every few minutes.
        </p>

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-3xl bg-white p-10 ring-1 ring-slate-200">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="text-sm font-semibold text-slate-500">Checking systems…</span>
            </div>
          ) : error ? (
            <div className="rounded-2xl border-2 border-cardinal-100 bg-cardinal-50 px-4 py-3 text-sm font-semibold text-cardinal-600">
              {error}
            </div>
          ) : (
            <>
              <OverallBanner overall={data.overall} />
              {data.overall === "unknown" && (
                <p className="mt-3 text-center text-xs font-semibold text-slate-400">
                  We just turned on monitoring — history will fill in over the next few minutes.
                </p>
              )}
              <div className="mt-4 space-y-3">
                {data.services.map((s) => (
                  <ServiceRow key={s.key} service={s} />
                ))}
              </div>
              <p className="mt-6 text-center text-xs font-semibold text-slate-400">
                Last updated {new Date(data.generated_at).toLocaleTimeString()} · refreshes automatically
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
