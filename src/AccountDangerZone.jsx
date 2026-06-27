// src/AccountDangerZone.jsx — data export + account deletion (GDPR self-service).
import React, { useState } from "react";
import { Download, Trash2, Loader2, AlertTriangle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

export default function AccountDangerZone() {
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function exportData() {
    setExporting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/me/export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "haylingua-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Couldn’t export your data. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setError("");
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setError('Type DELETE to confirm.');
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setDeleting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/me/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError((typeof d?.detail === "string" && d.detail) || "Could not delete account.");
        setDeleting(false);
        return;
      }
      ["hay_token", "access_token", "hay_user", "user_email", "hay_hearts", "hay_onboarding_completed"].forEach((k) =>
        localStorage.removeItem(k)
      );
      window.location.href = "/";
    } catch {
      setError("Network error. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-cardinal-100 shadow-sm">
      <h2 className="font-display text-lg font-extrabold text-slate-800">Your data &amp; account</h2>

      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-bold text-slate-800">Export your data</div>
            <div className="text-sm font-semibold text-slate-500">Download everything we store about you as a JSON file.</div>
          </div>
          <button onClick={exportData} disabled={exporting} className="btn3d btn3d-neutral shrink-0 text-sm">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-cardinal-50 p-4 ring-1 ring-cardinal-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-bold text-cardinal-700">Delete account</div>
            <div className="text-sm font-semibold text-cardinal-600">Permanently remove your account and all progress. This can’t be undone.</div>
          </div>
          <button
            onClick={() => { setOpen(true); setError(""); setPassword(""); setConfirmText(""); }}
            className="btn3d btn3d-cardinal shrink-0 text-sm"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cardinal-50 text-cardinal-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-xl font-extrabold text-slate-800">Delete your account?</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  This permanently deletes your profile, progress, XP, streak, and friends. It cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:outline-none focus:ring-cardinal-400 placeholder:text-slate-400"
              />
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:outline-none focus:ring-cardinal-400 placeholder:text-slate-400"
              />
              {error ? (
                <div className="rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">{error}</div>
              ) : null}
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={() => setOpen(false)} className="btn3d btn3d-neutral flex-1 uppercase">Cancel</button>
              <button onClick={deleteAccount} disabled={deleting} className="btn3d btn3d-cardinal flex-1 uppercase">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
