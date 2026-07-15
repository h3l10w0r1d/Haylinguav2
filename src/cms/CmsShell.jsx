// src/cms/CmsShell.jsx
import { useEffect, useMemo, useState } from "react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { BookOpen, Plus, Search, RefreshCw, Settings2, ListChecks, ArrowLeft, FileText, ChevronUp, ChevronDown, Sparkles, Loader2, Check, X, Trash2, Upload, FileUp, AlertTriangle } from "lucide-react";
import CmsLayout from "./CmsLayout";
import LessonEditor from "./LessonEditor";
import ExerciseEditor from "./ExerciseEditor";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

// First-attempt fail rate for one exercise, so a content quality problem is
// visible right in the list — not buried behind a trip to Analytics. Silent
// (renders nothing) below a minimum sample size; a fail rate computed from
// 1-2 attempts is noise, not signal.
const MIN_FAIL_RATE_SAMPLE = 5;
function FailRateBadge({ stats }) {
  if (!stats || stats.first_attempts < MIN_FAIL_RATE_SAMPLE || stats.fail_rate_pct == null) return null;
  const pct = stats.fail_rate_pct;
  const tone =
    pct >= 60
      ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-200"
      : pct >= 30
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-grass-50 text-grass-700 ring-grass-200";
  return (
    <span
      title={`${stats.first_attempts} first attempts, ${pct}% missed on the first try`}
      className={cx("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-extrabold ring-1", tone)}
    >
      {pct >= 30 ? <AlertTriangle className="h-3 w-3" /> : null}
      {pct}% miss
    </span>
  );
}

function LessonRow({ lesson, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full rounded-2xl px-3.5 py-2.5 text-left ring-1 transition",
        active
          ? "bg-brand-50 text-brand-700 ring-brand-200"
          : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="truncate font-semibold">{lesson.title}</div>
            {lesson.is_published === false ? (
              <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                Draft
              </span>
            ) : null}
          </div>
          <div className={cx("mt-0.5 text-xs", active ? "text-brand-600/80" : "text-slate-500")}>
            <span className="font-mono">{lesson.slug}</span> · lvl {lesson.level} · {lesson.xp} xp
          </div>
        </div>
        <BookOpen className={cx("mt-1 h-4 w-4 shrink-0", active ? "text-brand-500" : "text-slate-300")} />
      </div>
    </button>
  );
}

function SubTab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-display text-sm font-extrabold transition",
        active ? "bg-brand-500 text-white shadow-btn-brand" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

const AI_KIND_LABEL = {
  translate_mcq: "Translate MCQ",
  true_false: "True/False",
  word_bank: "Word bank",
  flashcard: "Flashcard",
};

function csvToList(v) {
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Compact, per-kind mini-editor for a single AI-generated draft — full
// editability without pulling in ExerciseEditor's whole config UI. Once
// added, the exercise can still be refined in the normal editor.
function AiDraftCard({ draft, onChange, onAdd, onRemove, adding }) {
  const { kind, prompt, xp, config } = draft;

  function patchConfig(patch) {
    onChange({ ...draft, config: { ...config, ...patch } });
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-extrabold text-brand-700 ring-1 ring-brand-200">
          {AI_KIND_LABEL[kind] || kind}
        </span>
        <button type="button" onClick={onRemove} className="text-slate-400 hover:text-cardinal-600" title="Discard">
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        value={prompt}
        onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
        placeholder="Instruction shown above the exercise"
        className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
      />

      {kind === "translate_mcq" && (
        <div className="space-y-2">
          <input
            value={config.sentence || ""}
            onChange={(e) => patchConfig({ sentence: e.target.value })}
            placeholder="Sentence to translate"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
          {(config.choices || []).map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                checked={Number(config.answerIndex) === i}
                onChange={() => patchConfig({ answerIndex: i })}
                className="accent-brand-500"
              />
              <input
                value={c}
                onChange={(e) => {
                  const next = [...(config.choices || [])];
                  next[i] = e.target.value;
                  patchConfig({ choices: next });
                }}
                className="w-full rounded-xl bg-slate-50 px-3 py-1.5 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      {kind === "true_false" && (
        <div className="space-y-2">
          <input
            value={config.statement || ""}
            onChange={(e) => patchConfig({ statement: e.target.value })}
            placeholder="Statement"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={config.correct === true} onChange={() => patchConfig({ correct: true })} className="accent-brand-500" /> True
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={config.correct === false} onChange={() => patchConfig({ correct: false })} className="accent-brand-500" /> False
            </label>
          </div>
        </div>
      )}

      {kind === "word_bank" && (
        <div className="space-y-2">
          <input
            value={config.sentence || ""}
            onChange={(e) => patchConfig({ sentence: e.target.value })}
            placeholder="Sentence to translate"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
          <input
            defaultValue={(config.tiles || []).join(", ")}
            onBlur={(e) => patchConfig({ tiles: csvToList(e.target.value) })}
            placeholder="Word tiles, comma-separated (include a couple distractors)"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
          <input
            defaultValue={(config.solution || []).join(", ")}
            onBlur={(e) => patchConfig({ solution: csvToList(e.target.value) })}
            placeholder="Correct answer, in order, comma-separated"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
        </div>
      )}

      {kind === "flashcard" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={config.front || ""}
            onChange={(e) => patchConfig({ front: e.target.value })}
            placeholder="Front (Armenian)"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
          <input
            value={config.back || ""}
            onChange={(e) => patchConfig({ back: e.target.value })}
            placeholder="Back (English)"
            className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          XP
          <input
            type="number"
            value={xp}
            onChange={(e) => onChange({ ...draft, xp: Number(e.target.value) || 0 })}
            className="w-16 rounded-lg bg-slate-50 px-2 py-1 text-xs ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          className="btn3d btn3d-brand text-xs !py-1.5 inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Add to lesson
        </button>
      </div>
    </div>
  );
}

function AiExerciseGenerator({ api, lessonId, onAdded, showToast }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drafts, setDrafts] = useState(null);
  const [addingId, setAddingId] = useState(null);

  async function generate() {
    const t = topic.trim();
    if (!t) return;
    setBusy(true);
    setErr("");
    try {
      const res = await api.generateExercises(t, null, Number(count) || 6);
      const list = Array.isArray(res?.exercises) ? res.exercises : [];
      setDrafts(list.map((e, i) => ({ ...e, _id: `${Date.now()}-${i}` })));
      if (list.length === 0) showToast?.("No exercises generated — try rephrasing the topic", "err");
    } catch (e) {
      setErr(e.message || "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(id, next) {
    setDrafts((prev) => prev.map((d) => (d._id === id ? next : d)));
  }
  function removeDraft(id) {
    setDrafts((prev) => prev.filter((d) => d._id !== id));
  }

  async function addDraft(d) {
    setAddingId(d._id);
    try {
      const { _id, ...payload } = d;
      await api.createExercise(lessonId, payload);
      removeDraft(d._id);
      onAdded?.();
      showToast?.("Exercise added");
    } catch (e) {
      showToast?.(e.message || "Failed to add exercise", "err");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="rounded-3xl bg-gradient-to-br from-brand-50 to-white p-4 ring-1 ring-brand-100">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-display text-sm font-extrabold text-slate-900">
          <Sparkles className="h-4 w-4 text-brand-500" /> Generate with AI
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic or vocab list, e.g. 'greetings: hello, goodbye, thank you, please, sorry'"
            rows={2}
            className="w-full rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:ring-brand-400 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              Count
              <input
                type="number"
                min={1}
                max={15}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-16 rounded-xl bg-white px-2 py-1.5 text-sm ring-2 ring-slate-200 focus:ring-brand-400 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={generate}
              disabled={busy || !topic.trim()}
              className="btn3d btn3d-brand text-sm !py-2 inline-flex items-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? "Generating…" : "Generate"}
            </button>
          </div>

          {err && (
            <div className="rounded-xl bg-cardinal-50 px-3 py-2 text-sm font-semibold text-cardinal-700 ring-1 ring-cardinal-200">
              {err}
            </div>
          )}

          {Array.isArray(drafts) && drafts.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  {drafts.length} draft{drafts.length === 1 ? "" : "s"} — review before adding
                </div>
                <button
                  type="button"
                  onClick={() => setDrafts([])}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-cardinal-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Discard all
                </button>
              </div>
              {drafts.map((d) => (
                <AiDraftCard
                  key={d._id}
                  draft={d}
                  onChange={(next) => updateDraft(d._id, next)}
                  onAdd={() => addDraft(d)}
                  onRemove={() => removeDraft(d._id)}
                  adding={addingId === d._id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Small dependency-free CSV parser — handles quoted fields (with escaped
// "" quotes and embedded commas/newlines), which is enough for lessons
// pasted out of a spreadsheet without pulling in a library for one screen.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  const s = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) pushRow();
  return rows.filter((r) => r.length > 1 || (r[0] || "").trim() !== "");
}

const BULK_IMPORT_COLUMNS = ["chapter", "title", "slug", "level", "xp", "description"];

function rowsFromCsv(text) {
  const table = parseCsv(text);
  if (table.length === 0) return [];
  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(BULK_IMPORT_COLUMNS.map((c) => [c, header.indexOf(c)]));
  return table.slice(1).map((cells) => ({
    chapter: idx.chapter >= 0 ? (cells[idx.chapter] || "").trim() : "",
    title: idx.title >= 0 ? (cells[idx.title] || "").trim() : "",
    slug: idx.slug >= 0 ? (cells[idx.slug] || "").trim() : "",
    level: idx.level >= 0 && cells[idx.level] ? Number(cells[idx.level]) || null : null,
    xp: idx.xp >= 0 && cells[idx.xp] ? Number(cells[idx.xp]) || null : null,
    description: idx.description >= 0 ? (cells[idx.description] || "").trim() : "",
  }));
}

function BulkImportPanel({ api, onDone, onClose, showToast }) {
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  }

  function preview() {
    const parsed = rowsFromCsv(csvText);
    setRows(parsed);
    setResults(null);
    if (parsed.length === 0) showToast?.("No rows found — check the CSV has a header row with at least 'title'", "err");
  }

  async function runImport() {
    const validRows = (rows || []).filter((r) => r.title);
    if (validRows.length === 0) return;
    setBusy(true);
    try {
      const res = await api.bulkImportLessons(validRows);
      setResults(res);
      if (res.created > 0) {
        showToast?.(`Imported ${res.created}/${res.total} lessons`);
        onDone?.();
      }
    } catch (e) {
      showToast?.(e.message || "Import failed", "err");
    } finally {
      setBusy(false);
    }
  }

  const missingTitleCount = (rows || []).filter((r) => !r.title).length;

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-bold text-slate-900">Bulk import lessons</div>
          <p className="mt-1 text-sm text-slate-600">
            CSV with columns: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">chapter, title, slug, level, xp, description</code>.
            Only <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">title</code> is required — a missing chapter is auto-created (as draft),
            a missing slug is generated from the title. Lessons import as drafts; add exercises after.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="btn3d btn3d-neutral text-sm !py-2 inline-flex items-center gap-2 cursor-pointer">
          <Upload className="h-4 w-4" /> Upload CSV
          <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        </label>
        <span className="text-xs font-semibold text-slate-400">or paste below</span>
      </div>

      <textarea
        value={csvText}
        onChange={(e) => { setCsvText(e.target.value); setRows(null); setResults(null); }}
        placeholder={"chapter,title,slug,level,xp,description\nGreetings,Say hello,say-hello,1,10,Greetings basics\nGreetings,Introduce yourself,,1,10,"}
        rows={6}
        className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-mono text-xs text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={preview}
          disabled={!csvText.trim()}
          className="btn3d btn3d-neutral text-sm !py-2 disabled:opacity-60"
        >
          Preview
        </button>
        {rows && rows.length > 0 && (
          <button
            type="button"
            onClick={runImport}
            disabled={busy || rows.every((r) => !r.title)}
            className="btn3d btn3d-brand text-sm !py-2 inline-flex items-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {busy ? "Importing…" : `Import ${rows.filter((r) => r.title).length} lesson${rows.filter((r) => r.title).length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {rows && !results && (
        <div className="rounded-2xl ring-1 ring-slate-200 overflow-hidden">
          {missingTitleCount > 0 && (
            <div className="bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
              {missingTitleCount} row{missingTitleCount === 1 ? "" : "s"} missing a title — will be skipped.
            </div>
          )}
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  {BULK_IMPORT_COLUMNS.map((c) => (
                    <th key={c} className="px-3 py-2 font-extrabold uppercase tracking-wide">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={cx("border-t border-slate-100", !r.title && "bg-cardinal-50/40")}>
                    <td className="px-3 py-1.5 text-slate-600">{r.chapter || "—"}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-800">{r.title || "(missing)"}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-500">{r.slug || "(auto)"}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.level ?? "1"}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.xp ?? "10"}</td>
                    <td className="px-3 py-1.5 text-slate-500">{r.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-2">
          <div className="text-sm font-extrabold text-slate-800">
            Imported {results.created} of {results.total}
          </div>
          <div className="max-h-64 overflow-auto rounded-2xl ring-1 ring-slate-200">
            {results.results.map((r) => (
              <div
                key={r.row}
                className={cx(
                  "flex items-center justify-between gap-2 px-3 py-2 text-xs border-t border-slate-100 first:border-t-0",
                  r.status === "created" ? "text-grass-700" : "text-cardinal-700 bg-cardinal-50/40"
                )}
              >
                <span>Row {r.row + 1}{r.slug ? ` — ${r.slug}` : ""}</span>
                <span className="font-semibold">{r.status === "created" ? "Created" : r.error}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={onClose} className="btn3d btn3d-brand text-sm !py-2">
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export default function CmsShell() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [lessons, setLessons] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [exerciseStats, setExerciseStats] = useState({}); // exercise_id -> {attempts, first_attempts, fail_rate_pct}
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [tab, setTab] = useState("settings"); // "settings" | "exercises"
  const [exEditing, setExEditing] = useState(null); // null (list) | "new" | exerciseId
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refreshLessons(preserveSelection = true) {
    const data = await api.listLessons();
    setLessons(Array.isArray(data) ? data : []);
    if (!preserveSelection) setSelectedLessonId(null);
  }

  async function refreshExercises(lessonId) {
    if (!lessonId) { setExercises([]); setExerciseStats({}); return; }
    const data = await api.listExercises(lessonId);
    setExercises(Array.isArray(data) ? data : []);
    // Best-effort — a stats fetch failure shouldn't block the exercise list.
    try {
      const stats = await api.getLessonExerciseStats(lessonId);
      const byId = Object.fromEntries((Array.isArray(stats) ? stats : []).map((s) => [s.exercise_id, s]));
      setExerciseStats(byId);
    } catch {
      setExerciseStats({});
    }
  }

  async function moveExercise(idx, dir) {
    const arr = sortedExercises.slice();
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    const [it] = arr.splice(idx, 1);
    arr.splice(j, 0, it);
    setExercises(arr.map((e, i) => ({ ...e, order: i + 1 }))); // optimistic
    try {
      await api.reorderExercises(arr.map((e) => e.id));
      await refreshExercises(selectedLessonId);
    } catch (e) {
      showToast(e.message || "Reorder failed", "err");
      await refreshExercises(selectedLessonId);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refreshLessons(false);
      } catch (e) {
        showToast(e.message || "Failed to load lessons", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        await refreshExercises(selectedLessonId);
      } catch (e) {
        showToast(e.message || "Failed to load exercises", "err");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLessonId]);

  const filteredLessons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter((l) =>
      [l.title, l.slug, l.description].some((x) => String(x || "").toLowerCase().includes(q))
    );
  }, [lessons, query]);

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) || null,
    [lessons, selectedLessonId]
  );

  const sortedExercises = useMemo(
    () => exercises.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [exercises]
  );

  const selectedExercise = useMemo(
    () => (typeof exEditing === "number" ? exercises.find((e) => e.id === exEditing) || null : null),
    [exercises, exEditing]
  );

  const lessonXpTotal = useMemo(
    () => exercises.reduce((sum, e) => sum + Number(e.xp || 0), 0),
    [exercises]
  );

  // ---- navigation helpers ----
  function openAllLessons() {
    setSelectedLessonId(null);
    setCreatingLesson(false);
    setBulkImportOpen(false);
    setExEditing(null);
  }
  function selectLesson(id) {
    setSelectedLessonId(id);
    setCreatingLesson(false);
    setBulkImportOpen(false);
    setTab("settings");
    setExEditing(null);
  }
  function startNewLesson() {
    setSelectedLessonId(null);
    setCreatingLesson(true);
    setBulkImportOpen(false);
    setExEditing(null);
  }
  function openBulkImport() {
    setSelectedLessonId(null);
    setCreatingLesson(false);
    setBulkImportOpen(true);
    setExEditing(null);
  }

  // ---- breadcrumb ----
  const breadcrumb = useMemo(() => {
    const crumbs = [{ label: "Lessons", onClick: openAllLessons }];
    if (bulkImportOpen) {
      crumbs.push({ label: "Bulk import" });
    } else if (creatingLesson) {
      crumbs.push({ label: "New lesson" });
    } else if (selectedLesson) {
      crumbs.push({ label: selectedLesson.title, onClick: () => selectLesson(selectedLesson.id) });
      if (tab === "exercises") {
        crumbs.push({ label: "Exercises", onClick: () => setExEditing(null) });
        if (exEditing === "new") crumbs.push({ label: "New exercise" });
        else if (selectedExercise) crumbs.push({ label: `#${selectedExercise.order ?? "?"} · ${selectedExercise.kind}` });
      }
    }
    return crumbs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkImportOpen, creatingLesson, selectedLesson, tab, exEditing, selectedExercise]);

  const actions = (
    <>
      <button type="button" onClick={startNewLesson} className="btn3d btn3d-brand text-sm !py-2 inline-flex items-center gap-2">
        <Plus className="h-4 w-4" /> New lesson
      </button>
      <button type="button" onClick={openBulkImport} className="btn3d btn3d-neutral text-sm !py-2 inline-flex items-center gap-2">
        <Upload className="h-4 w-4" /> Bulk import
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await refreshLessons(true);
            await refreshExercises(selectedLessonId);
            showToast("Refreshed");
          } catch (e) {
            showToast(e.message || "Refresh failed", "err");
          }
        }}
        className="btn3d btn3d-neutral text-sm !py-2 inline-flex items-center gap-2"
      >
        <RefreshCw className="h-4 w-4" /> Refresh
      </button>
    </>
  );

  return (
    <CmsLayout active="lessons" title="Lessons" breadcrumb={breadcrumb} actions={actions}>
      {bulkImportOpen ? (
        <BulkImportPanel
          api={api}
          showToast={showToast}
          onDone={async () => {
            await refreshLessons(false);
          }}
          onClose={openAllLessons}
        />
      ) : (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        {/* ---------- LEFT: lessons list ---------- */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lessons…"
              className="w-full rounded-2xl bg-white py-2.5 pl-10 pr-4 font-semibold ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="space-y-2 rounded-3xl bg-white p-2 ring-1 ring-slate-200 shadow-sm">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Loading…</div>
            ) : filteredLessons.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No lessons found.</div>
            ) : (
              filteredLessons.map((l) => (
                <LessonRow key={l.id} lesson={l} active={l.id === selectedLessonId} onClick={() => selectLesson(l.id)} />
              ))
            )}
          </div>
          <div className="px-1 text-xs font-semibold text-slate-400">
            {filteredLessons.length} lesson{filteredLessons.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* ---------- RIGHT: detail ---------- */}
        <div className="min-w-0">
          {/* Empty state */}
          {!selectedLesson && !creatingLesson && (
            <div className="grid place-items-center rounded-3xl bg-white p-12 text-center ring-1 ring-slate-200 shadow-sm">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                <FileText className="h-7 w-7" />
              </div>
              <div className="mt-3 font-display text-lg font-extrabold text-slate-800">Pick a lesson to edit</div>
              <p className="mt-1 max-w-sm font-semibold text-slate-500">
                Choose a lesson from the list, or create a new one to start building exercises.
              </p>
              <button type="button" onClick={startNewLesson} className="btn3d btn3d-brand mt-5 text-sm inline-flex items-center gap-2">
                <Plus className="h-4 w-4" /> New lesson
              </button>
            </div>
          )}

          {/* Create lesson */}
          {creatingLesson && (
            <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm md:p-6">
              <div className="mb-4">
                <div className="font-display text-xl font-bold text-slate-900">Create lesson</div>
                <div className="mt-0.5 text-xs text-slate-500">Add lesson metadata; you can add exercises after saving.</div>
              </div>
              <LessonEditor
                lesson={null}
                lessonXpTotal={0}
                onSaved={async (msg) => {
                  await refreshLessons(true);
                  setCreatingLesson(false);
                  showToast(msg || "Saved");
                }}
                onDeleted={async (msg) => {
                  await refreshLessons(false);
                  openAllLessons();
                  showToast(msg || "Deleted");
                }}
              />
            </div>
          )}

          {/* Lesson detail with sub-tabs */}
          {selectedLesson && (
            <div className="space-y-4">
              {/* sub-tab bar */}
              <div className="flex flex-wrap items-center gap-2">
                <SubTab active={tab === "settings"} onClick={() => { setTab("settings"); setExEditing(null); }} icon={Settings2}>
                  Lesson settings
                </SubTab>
                <SubTab active={tab === "exercises"} onClick={() => { setTab("exercises"); setExEditing(null); }} icon={ListChecks}>
                  Exercises · {exercises.length}
                </SubTab>
                <div className="ml-auto rounded-2xl bg-brand-50 px-3 py-1.5 text-xs font-extrabold text-brand-700 ring-1 ring-brand-200">
                  {lessonXpTotal} XP total
                </div>
              </div>

              {/* settings */}
              {tab === "settings" && (
                <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm md:p-6">
                  <LessonEditor
                    lesson={selectedLesson}
                    lessonXpTotal={lessonXpTotal}
                    onSaved={async (msg) => {
                      await refreshLessons(true);
                      showToast(msg || "Saved");
                    }}
                    onDeleted={async (msg) => {
                      await refreshLessons(false);
                      openAllLessons();
                      showToast(msg || "Deleted");
                    }}
                  />
                </div>
              )}

              {/* exercises */}
              {tab === "exercises" && exEditing === null && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-base font-bold text-slate-900">Exercises</div>
                    <button type="button" onClick={() => setExEditing("new")} className="btn3d btn3d-brand text-sm !py-2 inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" /> New exercise
                    </button>
                  </div>

                  <AiExerciseGenerator
                    api={api}
                    lessonId={selectedLessonId}
                    onAdded={() => refreshExercises(selectedLessonId)}
                    showToast={showToast}
                  />

                  {sortedExercises.length === 0 ? (
                    <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 shadow-sm">
                      <div className="font-display font-extrabold text-slate-700">No exercises yet</div>
                      <p className="mt-1 text-sm font-semibold text-slate-500">Add your first exercise to this lesson.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-3xl bg-white p-2 ring-1 ring-slate-200 shadow-sm">
                      {sortedExercises.map((ex, idx) => (
                        <div
                          key={ex.id}
                          className="flex items-center gap-2 rounded-2xl bg-white px-2 py-1.5 ring-1 ring-slate-200 transition hover:ring-brand-200"
                        >
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveExercise(idx, -1)}
                              disabled={idx === 0}
                              title="Move up"
                              className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveExercise(idx, 1)}
                              disabled={idx === sortedExercises.length - 1}
                              title="Move down"
                              className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExEditing(ex.id)}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 py-1 text-left"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 font-display text-sm font-extrabold text-slate-500">
                                {ex.order ?? "?"}
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-slate-800">{ex.prompt || "(no prompt)"}</div>
                                <div className="mt-0.5 text-xs font-semibold text-slate-400">
                                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-brand-700 ring-1 ring-brand-200">{ex.kind}</span>
                                  <span className="ml-2 font-mono">{Number(ex.xp || 0)} xp</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <FailRateBadge stats={exerciseStats[ex.id]} />
                              <span className="font-mono text-xs text-slate-300">id:{ex.id}</span>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* exercise editor */}
              {tab === "exercises" && exEditing !== null && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setExEditing(null)}
                    className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-500 transition hover:text-brand-600"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to exercises
                  </button>
                  <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm md:p-6">
                    <div className="mb-4 font-display text-lg font-bold text-slate-900">
                      {exEditing === "new" ? "Create exercise" : "Edit exercise"}
                    </div>
                    <ExerciseEditor
                      lessonId={selectedLessonId}
                      exercise={exEditing === "new" ? null : selectedExercise}
                      onSaved={async (msg) => {
                        await refreshExercises(selectedLessonId);
                        setExEditing(null);
                        showToast(msg || "Saved");
                      }}
                      onDeleted={async (msg) => {
                        await refreshExercises(selectedLessonId);
                        setExEditing(null);
                        showToast(msg || "Deleted");
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div
            className={cx(
              "rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ring-1",
              toast.kind === "err" ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-200" : "bg-grass-50 text-grass-700 ring-grass-200"
            )}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </CmsLayout>
  );
}
