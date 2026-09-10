// One-time banner that asks for browser notification permission, then
// actually subscribes to Web Push (public/sw.js + backend/webpush.py) so a
// signed-in learner can be reached by a server-driven campaign (streak-risk
// reminders, automation engine pushes) even when the tab is closed — not
// just the local, one-off `new Notification(...)` this used to fire.
// Shows only if permission is "default", the user hasn't dismissed it, and
// there's a signed-in session (a subscription is useless without a user to
// attach it to).
import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";

const STORAGE_KEY = "hay_notify_dismissed";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  return localStorage.getItem("hay_token") || localStorage.getItem("access_token") || "";
}

// The Push API wants the VAPID public key as a raw Uint8Array, not the
// base64url string the backend hands back.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

// Registers the service worker, subscribes (or reuses an existing
// subscription — pushManager.subscribe is idempotent per browser/origin),
// and upserts it server-side. Returns false (never throws) if push isn't
// supported, the backend hasn't configured VAPID keys yet, or anything else
// goes wrong — callers treat that as "couldn't enable it this time",
// not an error worth surfacing.
async function subscribeForWebPush(token) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const keyRes = await fetch(`${API_BASE}/webpush/vapid-public-key`);
    if (!keyRes.ok) return false;
    const { key } = await keyRes.json();

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    const json = subscription.toJSON();
    await fetch(`${API_BASE}/me/web-push-subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    return true;
  } catch {
    return false;
  }
}

export default function NotifyPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    const token = getToken();
    if (!token) return; // nothing to attach a subscription to when logged out

    if (Notification.permission === "granted") {
      // Already granted from a previous session (or before this feature
      // existed) — silently (re)sync the subscription so campaigns can
      // actually reach this browser. No banner needed either way.
      subscribeForWebPush(token);
      return;
    }
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    // Show after a short delay so it doesn't fight the page load
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  async function allow() {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      const subscribed = await subscribeForWebPush(getToken());
      if (subscribed) {
        new Notification("Haylingua reminders on! 🔥", {
          body: "We'll remind you when you have cards to review.",
          icon: "/web-app-manifest-192x192.png",
        });
      }
    }
    dismiss();
  }

  if (!visible) return null;

  return (
    <div data-print-hide className="fixed bottom-20 inset-x-4 z-50 md:bottom-6 md:right-6 md:left-auto md:max-w-sm animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600">
          <Bell size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">Stay on track with reminders</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Get notified when review cards are due or your streak is at risk.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={allow}
              className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-[0_3px_0_0_#c2410c] transition active:translate-y-0.5"
            >
              Enable
            </button>
            <button
              onClick={dismiss}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="shrink-0 text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
