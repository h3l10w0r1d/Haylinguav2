// src/Leaderboard.jsx
import { useEffect, useMemo, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import HeaderLayout from "./HeaderLayout";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function Leaderboard({ user, onLogout }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = useMemo(() => {
    return (
      localStorage.getItem("hay_token") ||
      localStorage.getItem("access_token") ||
      ""
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_BASE}/leaderboard?limit=50`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Failed to load leaderboard (${res.status})`);
        }

        const data = await res.json();
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[Leaderboard] load error:", e);
        if (!cancelled) setError(e.message || "Failed to load leaderboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <HeaderLayout user={user} onLogout={onLogout}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
            <p className="text-sm text-gray-600">Top learners by total XP.</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading leaderboard…
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-4 bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-3 text-xs font-semibold text-gray-500 bg-orange-50 border-b border-orange-100">
              <div className="col-span-2">Rank</div>
              <div className="col-span-6">User</div>
              <div className="col-span-2 text-right">XP</div>
              <div className="col-span-2 text-right">Lessons</div>
            </div>

            {rows.map((r) => {
              const isMe =
                user?.email &&
                typeof r?.name === "string" &&
                user.email.split("@")[0] === r.name;

              return (
                <div
                  key={r.user_id}
                  className={`grid grid-cols-12 px-4 py-3 border-b last:border-b-0 ${
                    isMe ? "bg-orange-50/60" : "bg-white"
                  }`}
                >
                  <div className="col-span-2 font-semibold text-gray-900">
                    #{r.rank}
                  </div>
                  <div className="col-span-6 text-gray-900 font-medium">
                    {r.name}
                    {isMe && (
                      <span className="ml-2 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-gray-900">
                    {r.total_xp}
                  </div>
                  <div className="col-span-2 text-right text-gray-600">
                    {r.lessons_completed}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </HeaderLayout>
  );
}
