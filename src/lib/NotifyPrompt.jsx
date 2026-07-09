// One-time banner that asks for browser notification permission.
// Shows only if permission is "default" and user hasn't dismissed it.
import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";

const STORAGE_KEY = "hay_notify_dismissed";

export default function NotifyPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
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
      new Notification("Haylingua reminders on! 🔥", {
        body: "We'll remind you when you have cards to review.",
        icon: "/favicon.ico",
      });
    }
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 inset-x-4 z-50 md:bottom-6 md:right-6 md:left-auto md:max-w-sm animate-in slide-in-from-bottom-4 duration-300">
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
