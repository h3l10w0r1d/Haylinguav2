// src/ForumCategoryPage.jsx — thread list within one forum category, plus a
// "new thread" composer for logged-in users.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Pin, Lock, MessageSquare, Plus, X, Loader2, AlertTriangle } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import AuthModal from "./AuthModal";
import usePageMeta from "./lib/usePageMeta";
import { getToken, apiFetch } from "./api";

function timeAgo(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function ForumCategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(getToken);

  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [authMode, setAuthMode] = useState(null); // null | "login" | "signup"

  usePageMeta(
    data?.category?.name ? `Community: ${data.category.name}` : "Community",
    data?.category?.description || "Ask questions, share tips, and talk with other Armenian learners in the Haylingua community forum."
  );

  useEffect(() => {
    setData(null);
    setError(false);
    apiFetch(`/forum/categories/${slug}/threads`, { method: "GET" })
      .then((d) => setData(d))
      .catch(() => setError(true));
  }, [slug]);

  async function submitThread(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || status === "sending") return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await apiFetch("/forum/threads", {
        method: "POST",
        token,
        body: { category_id: data.category.id, title: title.trim(), body: body.trim() },
      });
      navigate(`/community/thread/${res.id}`);
    } catch (err) {
      setStatus("idle");
      setErrorMsg(err.message || "Couldn't post — try again.");
      return;
    }
    setStatus("idle");
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/community" className="inline-flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-brand-500 dark:text-stone-500">
          <ChevronLeft className="h-4 w-4" /> Community
        </Link>

        {error ? (
          <div className="mt-6 rounded-3xl bg-cardinal-50 p-8 text-center text-sm font-semibold text-cardinal-700 ring-1 ring-cardinal-200 dark:bg-cardinal-500/10 dark:text-cardinal-300 dark:ring-cardinal-500/25">
            Couldn't load this category — it may not exist.
          </div>
        ) : data === null ? (
          <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">{data.category.name}</h1>
                {data.category.description && <p className="mt-1.5 text-sm font-semibold text-slate-500 dark:text-stone-400">{data.category.description}</p>}
              </div>
              {token ? (
                <button type="button" onClick={() => setComposerOpen((o) => !o)} className="btn3d btn3d-brand shrink-0 text-sm">
                  {composerOpen ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> New thread</>}
                </button>
              ) : (
                <button type="button" onClick={() => setAuthMode("signup")} className="btn3d btn3d-neutral shrink-0 text-sm">
                  Sign up to post
                </button>
              )}
            </div>

            {composerOpen && (
              <form onSubmit={submitThread} className="mt-6 space-y-3 rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Thread title"
                  maxLength={200}
                  className="w-full rounded-2xl bg-white px-4 py-3 font-bold text-slate-800 ring-2 ring-slate-200 transition focus:outline-none focus:ring-brand-400 placeholder:font-semibold placeholder:text-slate-400 dark:bg-white/[0.06] dark:text-white dark:ring-white/[0.08] dark:placeholder:text-stone-500"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={5}
                  maxLength={10000}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700 ring-2 ring-slate-200 transition focus:outline-none focus:ring-brand-400 placeholder:font-semibold placeholder:text-slate-400 dark:bg-white/[0.06] dark:text-stone-200 dark:ring-white/[0.08] dark:placeholder:text-stone-500"
                  data-gramm="false"
                  data-gramm_editor="false"
                  data-enable-grammarly="false"
                />
                {errorMsg && (
                  <div className="flex items-center gap-2 text-sm font-bold text-cardinal-600 dark:text-cardinal-400">
                    <AlertTriangle className="h-4 w-4" /> {errorMsg}
                  </div>
                )}
                <div className="flex justify-end">
                  <button type="submit" disabled={status === "sending" || !title.trim() || !body.trim()} className="btn3d btn3d-brand text-sm disabled:opacity-60">
                    {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post thread"}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 space-y-2">
              {data.threads.length === 0 ? (
                <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:text-stone-400 dark:ring-white/[0.08]">
                  No threads yet — be the first to post.
                </div>
              ) : (
                data.threads.map((t) => (
                  <Link
                    key={t.id}
                    to={`/community/thread/${t.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {t.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-gold-500" />}
                        {t.is_locked && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                        <div className="truncate font-bold text-slate-800 dark:text-white">{t.title}</div>
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-stone-500">by {t.author_name} · {timeAgo(t.last_reply_at)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-slate-500 tabular-nums dark:text-stone-400">
                      <MessageSquare className="h-4 w-4" /> {t.reply_count}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <SiteFooter />

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSwitchMode={setAuthMode}
          onAuthSuccess={() => {
            setToken(getToken());
            setComposerOpen(true);
          }}
        />
      )}
    </div>
  );
}
