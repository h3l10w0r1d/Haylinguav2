// src/cms/CmsLessonEditor.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  cmsDeleteLesson,
  cmsGetLesson,
  cmsListExercises,
  cmsCreateExercise,
  cmsUpdateLesson,
  cmsDeleteExercise,
} from "./cmsApi";
import { ArrowLeft, Loader2, Plus, Trash2, Save } from "lucide-react";

function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl px-3 py-2 ring-1 ring-slate-200 focus:outline-none focus:ring-orange-300 text-sm",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={[
        "w-full rounded-xl px-3 py-2 ring-1 ring-slate-200 focus:outline-none focus:ring-orange-300 text-sm min-h-[90px]",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-xl px-3 py-2 ring-1 ring-slate-200 focus:outline-none focus:ring-orange-300 text-sm bg-white"
    />
  );
}

const KIND_PRESETS = [
  { kind: "char_intro", label: "Char intro" },
  { kind: "letter_recognition", label: "Letter recognition (MCQ)" },
  { kind: "letter_typing", label: "Letter typing" },
  { kind: "word_spelling", label: "Word spelling" },
  { kind: "char_build_word", label: "Build word" },
  // (If you added more kinds later, add here)
];

export default function CmsLessonEditor() {
  const { cmsKey, lessonId } = useParams();
  const base = `/${cmsKey}/cms`;
  const nav = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // edit state
  const [form, setForm] = useState({
    slug: "",
    title: "",
    description: "",
    level: 1,
    xp: 40,
    xp_reward: 40,
  });

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const l = await cmsGetLesson(lessonId);
      const ex = await cmsListExercises(lessonId);

      setLesson(l);
      setExercises(Array.isArray(ex) ? ex : []);

      setForm({
        slug: l.slug || "",
        title: l.title || "",
        description: l.description || "",
        level: l.level ?? 1,
        xp: l.xp ?? 40,
        xp_reward: l.xp_reward ?? 40,
      });
    } catch (e) {
      setErr(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [lessonId]);

  const sortedExercises = useMemo(() => {
    const arr = [...exercises];
    arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return arr;
  }, [exercises]);

  async function saveLesson() {
    setSaving(true);
    setErr("");
    try {
      const payload = {
        ...form,
        level: Number(form.level || 1),
        xp: Number(form.xp || 0),
        xp_reward: Number(form.xp_reward || 0),
      };
      await cmsUpdateLesson(lessonId, payload);
      await load();
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addExercise(kind) {
    // Minimal creation with defaults
    const payload = {
      kind,
      prompt: "New exercise",
      expected_answer: kind === "char_intro" ? null : "",
      sentence_before: null,
      sentence_after: null,
      order: exercises.length + 1,
      config: kind === "letter_recognition" ? { choices: ["A", "B", "C", "D"] } : {},
    };

    try {
      await cmsCreateExercise(lessonId, payload);
      await load();
    } catch (e) {
      alert(e.message || "Failed to add exercise");
    }
  }

  async function removeExercise(id) {
    if (!confirm("Delete this exercise?")) return;
    try {
      await cmsDeleteExercise(id);
      await load();
    } catch (e) {
      alert(e.message || "Delete failed");
    }
  }

  async function deleteLesson() {
    if (!confirm("Delete this lesson and its exercises?")) return;
    try {
      await cmsDeleteLesson(lessonId);
      nav(`${base}/lessons`, { replace: true });
    } catch (e) {
      alert(e.message || "Delete failed");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 text-red-700 ring-1 ring-red-200 rounded-2xl p-4 text-sm">
          {err}
        </div>
        <button
          type="button"
          onClick={() => nav(`${base}/lessons`)}
          className="px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 text-sm font-semibold"
        >
          Back to lessons
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => nav(`${base}/lessons`)}
            className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to lessons
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">
            Edit lesson
          </h1>
          <p className="text-sm text-slate-600">
            ID: {lesson?.id} · slug: <span className="font-mono">{lesson?.slug}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveLesson}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save"}
          </button>

          <button
            type="button"
            onClick={deleteLesson}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white ring-1 ring-red-200 text-red-700 text-sm font-semibold hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Lesson fields */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Slug">
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </Field>

        <Field label="Title">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>

        <Field label="Level">
          <Input
            type="number"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
          />
        </Field>

        <Field label="XP">
          <Input
            type="number"
            value={form.xp}
            onChange={(e) => setForm({ ...form, xp: e.target.value })}
          />
        </Field>

        <Field label="XP Reward">
          <Input
            type="number"
            value={form.xp_reward}
            onChange={(e) => setForm({ ...form, xp_reward: e.target.value })}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </div>
      </div>

      {/* Exercise list */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Exercises</div>
            <div className="text-sm text-slate-600">
              Order matters. Keep “kind” consistent with your ExerciseRenderer.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select onChange={(e) => addExercise(e.target.value)} defaultValue="">
              <option value="" disabled>
                + Add exercise…
              </option>
              {KIND_PRESETS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sortedExercises.length === 0 ? (
            <div className="text-sm text-slate-600">No exercises yet.</div>
          ) : null}

          {sortedExercises.map((ex) => (
            <div
              key={ex.id}
              className="rounded-2xl ring-1 ring-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-3 md:justify-between"
            >
              <div className="min-w-0">
                <div className="text-xs text-slate-500">
                  #{ex.order ?? "?"} · kind:{" "}
                  <span className="font-mono text-slate-700">{ex.kind}</span> · id: {ex.id}
                </div>
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {ex.prompt || "(no prompt)"}
                </div>
                {ex.expected_answer ? (
                  <div className="text-xs text-slate-500 mt-1">
                    expected: <span className="font-mono">{ex.expected_answer}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert("Next: we add Exercise Editor modal/page")}
                  className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeExercise(ex.id)}
                  className="px-4 py-2 rounded-xl bg-white ring-1 ring-red-200 text-red-700 text-sm font-semibold hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Minimal footer */}
        <div className="mt-4 text-xs text-slate-500">
          Next step: Exercise editor (prompt, expected_answer, config JSON builder per kind).
        </div>
      </div>
    </div>
  );
}
