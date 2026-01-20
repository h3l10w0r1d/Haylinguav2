// src/cms/LessonEditor.jsx
import { useEffect, useMemo, useState } from "react";
import { cmsApi } from "./api";
import { Trash2, Save } from "lucide-react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      {children}
      {hint ? <div className="text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-xl px-3 py-2 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm",
        props.className
      )}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-xl px-3 py-2 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm min-h-[96px]",
        props.className
      )}
    />
  );
}

/**
 * Props:
 *  - lesson: lesson object or null (null means create mode)
 *  - onSaved: (msg?: string) => void
 *  - onDeleted: (msg?: string) => void
 */
export default function LessonEditor({ lesson, onSaved, onDeleted }) {
  const isEdit = !!lesson?.id;

  const [form, setForm] = useState({
    slug: "",
    title: "",
    description: "",
    level: 1,
    xp: 40,
    xp_reward: 40,
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Ensure cmsApi is ready (CmsShell sets it)
  const apiReady = useMemo(() => !!cmsApi, [lesson?.id]);

  useEffect(() => {
    setErr("");

    if (lesson) {
      setForm({
        slug: lesson.slug || "",
        title: lesson.title || "",
        description: lesson.description || "",
        level: lesson.level ?? 1,
        xp: lesson.xp ?? 40,
        xp_reward: lesson.xp_reward ?? 40,
      });
    } else {
      // create mode defaults
      setForm({
        slug: "",
        title: "",
        description: "",
        level: 1,
        xp: 40,
        xp_reward: 40,
      });
    }
  }, [lesson?.id]);

  function validate() {
    const slug = String(form.slug || "").trim();
    const title = String(form.title || "").trim();

    if (!slug) return "Slug is required.";
    if (!/^[a-z0-9-]+$/i.test(slug)) return "Slug should contain only letters, numbers, and dashes.";
    if (!title) return "Title is required.";

    // numeric checks
    const lvl = Number(form.level);
    const xp = Number(form.xp);
    const xpr = Number(form.xp_reward);

    if (!Number.isFinite(lvl) || lvl < 1) return "Level must be a number >= 1.";
    if (!Number.isFinite(xp) || xp < 0) return "XP must be a number >= 0.";
    if (!Number.isFinite(xpr) || xpr < 0) return "XP reward must be a number >= 0.";

    return "";
  }

  async function save() {
    if (!cmsApi) {
      setErr("CMS API is not initialized. Open this editor through CmsShell route.");
      return;
    }

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setSaving(true);
    setErr("");

    try {
      const payload = {
        slug: String(form.slug).trim(),
        title: String(form.title).trim(),
        description: String(form.description || ""),
        level: Number(form.level),
        xp: Number(form.xp),
        xp_reward: Number(form.xp_reward),
      };

      if (isEdit) {
        await cmsApi.updateLesson(lesson.id, payload);
        onSaved?.("Lesson updated");
      } else {
        await cmsApi.createLesson(payload);
        onSaved?.("Lesson created");
      }
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!cmsApi) {
      setErr("CMS API is not initialized. Open this editor through CmsShell route.");
      return;
    }
    if (!isEdit) return;
    if (!confirm("Delete this lesson? This does NOT automatically delete exercises unless your backend does.")) return;

    setSaving(true);
    setErr("");

    try {
      await cmsApi.deleteLesson(lesson.id);
      onDeleted?.("Lesson deleted");
    } catch (e) {
      setErr(e.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {!apiReady ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm font-semibold">
          CMS API is not initialized. Make sure you opened the CMS through the token route
          so `X-CMS-Token` is attached.
        </div>
      ) : null}

      {err ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm font-semibold">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Slug" hint="Used in URLs. Prefer stable slugs.">
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="alphabet-1"
          />
        </Field>

        <Field label="Title" hint="Shown to learners in the path.">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Alphabet 1: First Letters"
          />
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

        <Field label="XP Reward" hint="Optional: used by backend if you reward on completion.">
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
              placeholder="What the learner will do in this lesson…"
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create lesson"}
        </button>

        {isEdit ? (
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        ) : (
          <div className="text-xs text-slate-500">
            Tip: Create the lesson first, then add exercises.
          </div>
        )}
      </div>
    </div>
  );
}
