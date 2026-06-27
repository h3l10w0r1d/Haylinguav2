// src/OutOfHearts.jsx — shown in a lesson when the learner runs out of hearts.
import React, { useEffect, useRef, useState } from "react";
import { Heart, Crown } from "lucide-react";
import grandma from "./assets/character-grandma.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}
function fmt(total) {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function OutOfHearts({ nextRegenSeconds = 0, onGoPremium, onBack, onRefilled }) {
  const [remaining, setRemaining] = useState(nextRegenSeconds || 0);
  const checkedRef = useRef(false);

  useEffect(() => {
    setRemaining(nextRegenSeconds || 0);
    checkedRef.current = false;
  }, [nextRegenSeconds]);

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  // When the timer hits 0, ask the server whether a heart regenerated.
  useEffect(() => {
    if (remaining > 0 || checkedRef.current) return;
    checkedRef.current = true;
    const token = getToken();
    if (!token) return;
    fetch(`${API_BASE}/me/hearts`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) onRefilled?.(d); })
      .catch(() => {});
  }, [remaining, onRefilled]);

  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 shadow-sm">
      <img src={grandma} alt="" className="mx-auto h-24 w-24 rounded-3xl object-cover" />

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Heart key={i} className="h-6 w-6 fill-slate-200 text-slate-200" />
        ))}
      </div>

      <h2 className="mt-4 font-display text-2xl font-extrabold text-slate-800">You’re out of hearts!</h2>
      <p className="mt-1 font-semibold text-slate-500">
        {remaining > 0 ? (
          <>Next heart in <span className="font-display font-extrabold text-cardinal-500">{fmt(remaining)}</span></>
        ) : (
          "A heart should be ready — checking…"
        )}
      </p>

      <div className="mt-6 space-y-3">
        <button onClick={onGoPremium} className="btn3d btn3d-brand w-full uppercase">
          <Crown className="h-5 w-5" /> Get unlimited hearts
        </button>
        <button onClick={onBack} className="btn3d btn3d-neutral w-full uppercase">
          Back to learning
        </button>
      </div>
    </div>
  );
}
