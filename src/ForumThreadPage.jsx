// src/ForumThreadPage.jsx — a single forum thread: original post, replies,
// and a reply box for logged-in users.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Pin, Lock, Loader2, AlertTriangle, Send, Trash2 } from "lucide-react";
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

function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

function Post({ post, isRoot, canDelete, onDelete }) {
  return (
    <div className={`flex gap-3 rounded-2xl p-4 ring-1 ${isRoot ? "bg-brand-50/50 ring-brand-100 dark:bg-brand-500/[0.06] dark:ring-brand-500/20" : "bg-white ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]"}`}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-extrabold text-white">
        {initials(post.author_name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-800 dark:text-white">{post.author_name}</span>
          <span className="text-xs font-semibold text-slate-400 dark:text-stone-500">{timeAgo(post.created_at)}</span>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-600 dark:text-stone-300">{post.body}</p>
        {canDelete && (
          <button type="button" onClick={onDelete} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-cardinal-600 dark:text-stone-500 dark:hover:text-cardinal-400">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function ForumThreadPage() {
  const { id } = useParams();
  const [token, setToken] = useState(getToken);

  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [me, setMe] = useState(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [authMode, setAuthMode] = useState(null); // null | "login" | "signup"

  usePageMeta(
    data?.thread?.title,
    data?.posts?.[0]?.body?.slice(0, 155) || "Join the conversation in the Haylingua community forum."
  );

  async function load() {
    try {
      const d = await apiFetch(`/forum/threads/${id}`, { method: "GET" });
      setData(d);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    setData(null);
    setError(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (token) apiFetch("/me/profile", { token }).then(setMe).catch(() => {});
  }, [token]);

  async function submitReply(e) {
    e.preventDefault();
    if (!reply.trim() || status === "sending") return;
    setStatus("sending");
    setErrorMsg("");
    try {
      await apiFetch(`/forum/threads/${id}/posts`, { method: "POST", token, body: { body: reply.trim() } });
      setReply("");
      await load();
    } catch (err) {
      setErrorMsg(err.message || "Couldn't post — try again.");
    } finally {
      setStatus("idle");
    }
  }

  async function deletePost(postId) {
    if (!confirm("Delete this reply?")) return;
    try {
      await apiFetch(`/forum/posts/${postId}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      alert(err.message || "Couldn't delete — try again.");
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      <div className="mx-auto max-w-3xl px-5 py-10">
        {error ? (
          <div className="mt-6 rounded-3xl bg-cardinal-50 p-8 text-center text-sm font-semibold text-cardinal-700 ring-1 ring-cardinal-200 dark:bg-cardinal-500/10 dark:text-cardinal-300 dark:ring-cardinal-500/25">
            Couldn't load this thread — it may not exist.
          </div>
        ) : data === null ? (
          <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <Link to={`/community/${data.thread.category_slug}`} className="inline-flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-brand-500 dark:text-stone-500">
              <ChevronLeft className="h-4 w-4" /> {data.thread.category_name}
            </Link>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {data.thread.is_pinned && <Pin className="h-4 w-4 text-gold-500" />}
              {data.thread.is_locked && <Lock className="h-4 w-4 text-slate-400" />}
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-3xl">{data.thread.title}</h1>
            </div>

            <div className="mt-6 space-y-3">
              {data.posts.map((p, i) => (
                <Post
                  key={p.id}
                  post={p}
                  isRoot={i === 0}
                  canDelete={i > 0 && me && Number(p.author_id) === Number(me.id)}
                  onDelete={() => deletePost(p.id)}
                />
              ))}
            </div>

            <div className="mt-6">
              {data.thread.is_locked ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:text-stone-400 dark:ring-white/[0.08]">
                  <Lock className="mx-auto mb-1 h-4 w-4" /> This thread is locked — no new replies.
                </div>
              ) : token ? (
                <form onSubmit={submitReply} className="space-y-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply…"
                    rows={3}
                    maxLength={10000}
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:font-semibold placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-stone-200 dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
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
                    <button type="submit" disabled={status === "sending" || !reply.trim()} className="btn3d btn3d-brand text-sm disabled:opacity-60">
                      {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Reply</>}
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setAuthMode("signup")} className="btn3d btn3d-neutral w-full text-sm justify-center">
                  Sign up to reply
                </button>
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
          onAuthSuccess={() => setToken(getToken())}
        />
      )}
    </div>
  );
}
