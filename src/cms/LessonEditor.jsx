// src/cms/LessonEditor.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { cmsApi } from "./api";
import { Save, Trash2, Plus, GripVertical, X, Search } from "lucide-react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function Field({ label, hint, children }) {
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
 *  - lesson: lesson object OR null (null means create mode)
 *  - onSaved(msg?)
 *  - onDeleted(msg?)
 */
export default function LessonEditor({ lesson, onSaved, onDeleted }) {
  const isEdit = !!lesson?.id;

  const [availableExercises, setAvailableExercises] = useState([]);
  const [exSearch, setExSearch] = useState("");
  const [lessonType, setLessonType] = useState("standard");
  const [reading, setReading] = useState({
    sections: [],
  });

  // drag state
  const dragRef = useRef({ kind: null });

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

      setLessonType(String(lesson.lesson_type || "standard"));
      const cfg = lesson.config && typeof lesson.config === "object" ? lesson.config : {};
      setReading({
        sections: Array.isArray(cfg?.reading?.sections)
          ? cfg.reading.sections.map((s) => ({
              id: s.id || crypto.randomUUID(),
              title: s.title || "",
              text: s.text || "",
              rate_beginner: Number(s.rate_beginner ?? 0.85),
              rate_intermediate: Number(s.rate_intermediate ?? 1.0),
              rate_advanced: Number(s.rate_advanced ?? 1.1),
              exercise_ids: Array.isArray(s.exercise_ids)
                ? s.exercise_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
                : [],
            }))
          : [],
      });
    } else {
      setForm({
        slug: "",
        title: "",
        description: "",
        level: 1,
        xp: 40,
        xp_reward: 40,
      });

      setLessonType("standard");
      setReading({ sections: [] });
    }
  }, [lesson?.id]);

  useEffect(() => {
    let alive = true;
    async function loadExercises() {
      if (!cmsApi || !isEdit) {
        setAvailableExercises([]);
        return;
      }
      try {
        const list = await cmsApi.listExercises(lesson.id);
        if (!alive) return;
        setAvailableExercises(Array.isArray(list) ? list : []);
      } catch {
        if (!alive) return;
        setAvailableExercises([]);
      }
    }
    loadExercises();
    return () => {
      alive = false;
    };
  }, [isEdit, lesson?.id]);

  const filteredExercises = useMemo(() => {
    const q = String(exSearch || "").trim().toLowerCase();
    if (!q) return availableExercises;
    return availableExercises.filter((ex) => {
      const hay = `${ex.id} ${ex.kind || ""} ${ex.prompt || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [availableExercises, exSearch]);

  const exById = useMemo(() => {
    const m = new Map();
    for (const ex of availableExercises) m.set(Number(ex.id), ex);
    return m;
  }, [availableExercises]);

  function validate() {
    const slug = String(form.slug || "").trim();
    const title = String(form.title || "").trim();

    if (!slug) return "Slug is required.";
    if (!/^[a-z0-9-]+$/i.test(slug)) return "Slug must contain only letters, numbers, and dashes.";
    if (!title) return "Title is required.";

    const level = Number(form.level);
    const xp = Number(form.xp);
    const xpReward = Number(form.xp_reward);

    if (!Number.isFinite(level) || level < 1) return "Level must be >= 1.";
    if (!Number.isFinite(xp) || xp < 0) return "XP must be >= 0.";
    if (!Number.isFinite(xpReward) || xpReward < 0) return "XP reward must be >= 0.";

    return "";
  }

  async function save() {
    if (!cmsApi) {
      setErr("CMS API not initialized. Open CMS through token route so X-CMS-Token is set.");
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
        lesson_type: String(lessonType || "standard"),
        config:
          String(lessonType || "standard") === "reading"
            ? {
                reading: {
                  sections: (reading.sections || []).map((s) => ({
                    id: s.id,
                    title: String(s.title || ""),
                    text: String(s.text || ""),
                    rate_beginner: Number(s.rate_beginner ?? 0.85),
                    rate_intermediate: Number(s.rate_intermediate ?? 1.0),
                    rate_advanced: Number(s.rate_advanced ?? 1.1),
                    exercise_ids: (s.exercise_ids || [])
                      .map((x) => Number(x))
                      .filter((n) => Number.isFinite(n) && n > 0),
                  })),
                },
              }
            : {},
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

  function addSection() {
    setReading((prev) => ({
      ...prev,
      sections: [
        ...(prev.sections || []),
        {
          id: crypto.randomUUID(),
          title: "",
          text: "",
          rate_beginner: 0.85,
          rate_intermediate: 1.0,
          rate_advanced: 1.1,
          exercise_ids: [],
        },
      ],
    }));
  }

  function removeSection(idx) {
    setReading((prev) => ({
      ...prev,
      sections: (prev.sections || []).filter((_, i) => i !== idx),
    }));
  }

  function updateSection(idx, patch) {
    setReading((prev) => ({
      ...prev,
      sections: (prev.sections || []).map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function addExerciseToSection(idx, exerciseId) {
    const id = Number(exerciseId);
    if (!Number.isFinite(id) || id <= 0) return;
    setReading((prev) => ({
      ...prev,
      sections: (prev.sections || []).map((s, i) => {
        if (i !== idx) return s;
        const next = Array.from(new Set([...(s.exercise_ids || []), id]));
        return { ...s, exercise_ids: next };
      }),
    }));
  }

  function removeExerciseFromSection(sectionIdx, exIdx) {
    setReading((prev) => ({
      ...prev,
      sections: (prev.sections || []).map((s, i) => {
        if (i !== sectionIdx) return s;
        return { ...s, exercise_ids: (s.exercise_ids || []).filter((_, j) => j !== exIdx) };
      }),
    }));
  }

  function moveItem(arr, from, to) {
    const a = arr.slice();
    const [it] = a.splice(from, 1);
    a.splice(to, 0, it);
    return a;
  }

  function onSectionDragStart(idx) {
    dragRef.current = { kind: "section", idx };
  }

  function onSectionDrop(targetIdx) {
    const d = dragRef.current;
    if (d.kind !== "section") return;
    const from = d.idx;
    if (from === targetIdx) return;
    setReading((prev) => ({
      ...prev,
      sections: moveItem(prev.sections || [], from, targetIdx),
    }));
    dragRef.current = { kind: null };
  }

  function onExerciseDragStart(sectionIdx, exIdx) {
    dragRef.current = { kind: "exercise", sectionIdx, exIdx };
  }

  function onExerciseDrop(sectionIdx, targetExIdx) {
    const d = dragRef.current;
    if (d.kind !== "exercise") return;
    if (d.sectionIdx !== sectionIdx) return; // MVP: no cross-section drag
    const from = d.exIdx;
    if (from === targetExIdx) return;
    setReading((prev) => ({
      ...prev,
      sections: (prev.sections || []).map((s, i) => {
        if (i !== sectionIdx) return s;
        return { ...s, exercise_ids: moveItem(s.exercise_ids || [], from, targetExIdx) };
      }),
    }));
    dragRef.current = { kind: null };
  }

  async function remove() {
    if (!cmsApi) {
      setErr("CMS API not initialized. Open CMS through token route so X-CMS-Token is set.");
      return;
    }
    if (!isEdit) return;

    if (!confirm("Delete this lesson?")) return;

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
      {err ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm font-semibold">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Slug" hint="Used in URLs. Keep stable. Example: alphabet-1">
          <Input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="alphabet-1"
          />
        </Field>

        <Field label="Title">
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

        <Field label="Lesson Type" hint="Reading lessons are story-like lessons that embed exercises inside a reading flow.">
          <select
            value={lessonType}
            onChange={(e) => setLessonType(e.target.value)}
            className="w-full rounded-xl px-3 py-2 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
          >
            <option value="standard">Standard</option>
            <option value="reading">Reading (Story)</option>
          </select>
        </Field>

        <Field label="XP" hint="Auto-calculated from the XP of exercises in this lesson (read-only)">
          <Input
            type="number"
            value={form.xp}
            onChange={(e) => setForm({ ...form, xp: e.target.value })}
            disabled
          />
        </Field>

        <Field label="XP Reward" hint="Optional (legacy). Prefer setting XP on each exercise.">
          <Input
            type="number"
            value={form.xp_reward}
            onChange={(e) => setForm({ ...form, xp_reward: e.target.value })}
            disabled
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Start learning the Armenian alphabet…"
            />
          </Field>
        </div>
      </div>

      {lessonType === "reading" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-slate-800">Reading Lesson Builder</div>
              <div className="text-xs text-slate-500">
                Build a smooth reading flow. Add reading sections, then attach exercises as checkpoints.
              </div>
            </div>
            <button
              type="button"
              onClick={addSection}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              Add section
            </button>
          </div>

          {!isEdit ? (
            <div className="text-xs text-slate-500">
              Create the lesson first to load exercises, then build the reading flow.
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  value={exSearch}
                  onChange={(e) => setExSearch(e.target.value)}
                  placeholder="Search exercises (id, kind, prompt)…"
                  className="w-full rounded-xl px-3 py-2 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 text-xs"
                />
              </div>
              <div className="text-[11px] text-slate-500">Exercises in this lesson</div>
              <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
                {filteredExercises.length ? (
                  filteredExercises.map((ex) => (
                    <div key={ex.id} className="rounded-xl border border-slate-200 bg-white p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-800">#{ex.id}</div>
                        <div className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {ex.kind}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                        {String(ex.prompt || "").slice(0, 140) || "(no prompt)"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">No exercises found.</div>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                Tip: Add exercises below by selecting an exercise ID in a section. Drag exercises to reorder.
              </div>
            </div>

            <div className="lg:col-span-2 space-y-3">
              {(reading.sections || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <div className="text-sm font-bold text-slate-700">No sections yet</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Add your first reading section. Then attach exercises as checkpoints.
                  </div>
                </div>
              ) : null}

              {(reading.sections || []).map((s, idx) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                  draggable
                  onDragStart={() => onSectionDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onSectionDrop(idx)}
                >
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-slate-400" />
                      <div className="text-sm font-extrabold text-slate-800">Section {idx + 1}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSection(idx)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-800"
                      title="Remove section"
                    >
                      <X className="w-4 h-4" />
                      Remove
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    <Field label="Title (optional)">
                      <Input
                        value={s.title}
                        onChange={(e) => updateSection(idx, { title: e.target.value })}
                        placeholder="e.g., At the café"
                      />
                    </Field>

                    <Field label="Passage text" hint="Keep it short. This will be the reading part shown to learners.">
                      <Textarea
                        value={s.text}
                        onChange={(e) => updateSection(idx, { text: e.target.value })}
                        placeholder="Write the reading passage here…"
                        className="min-h-[140px]"
                      />
                    </Field>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Field label="Rate (Beginner)" hint="Playback rate">
                        <Input
                          type="number"
                          step="0.05"
                          value={s.rate_beginner}
                          onChange={(e) => updateSection(idx, { rate_beginner: e.target.value })}
                        />
                      </Field>
                      <Field label="Rate (Intermediate)" hint="Playback rate">
                        <Input
                          type="number"
                          step="0.05"
                          value={s.rate_intermediate}
                          onChange={(e) => updateSection(idx, { rate_intermediate: e.target.value })}
                        />
                      </Field>
                      <Field label="Rate (Advanced)" hint="Playback rate">
                        <Input
                          type="number"
                          step="0.05"
                          value={s.rate_advanced}
                          onChange={(e) => updateSection(idx, { rate_advanced: e.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <div className="text-xs font-extrabold text-slate-800">Checkpoint exercises</div>
                          <div className="text-[11px] text-slate-500">
                            Drag to reorder. Learners must complete these before continuing.
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="rounded-xl px-3 py-2 border border-slate-200 bg-white text-xs"
                            defaultValue=""
                            onChange={(e) => {
                              addExerciseToSection(idx, e.target.value);
                              e.target.value = "";
                            }}
                            disabled={!isEdit}
                            title={!isEdit ? "Create lesson first" : "Add an exercise"}
                          >
                            <option value="">+ Add exercise…</option>
                            {availableExercises.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                #{ex.id} · {ex.kind}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(s.exercise_ids || []).length ? (
                          (s.exercise_ids || []).map((eid, exIdx) => {
                            const ex = exById.get(Number(eid));
                            return (
                              <div
                                key={`${s.id}:${eid}:${exIdx}`}
                                className="rounded-xl border border-slate-200 bg-white p-2 flex items-start justify-between gap-2"
                                draggable
                                onDragStart={() => onExerciseDragStart(idx, exIdx)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => onExerciseDrop(idx, exIdx)}
                              >
                                <div className="flex items-start gap-2">
                                  <GripVertical className="w-4 h-4 text-slate-400 mt-0.5" />
                                  <div>
                                    <div className="text-xs font-extrabold text-slate-800">
                                      #{eid}{" "}
                                      <span className="text-[11px] font-semibold text-slate-500">
                                        {ex?.kind ? `· ${ex.kind}` : ""}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-600 line-clamp-2">
                                      {ex?.prompt ? String(ex.prompt).slice(0, 140) : "(prompt not loaded)"}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeExerciseFromSection(idx, exIdx)}
                                  className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 hover:bg-red-50"
                                  title="Remove"
                                >
                                  <X className="w-4 h-4 text-red-700" />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-500">No exercises yet. Add from the dropdown.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

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
            Create the lesson first, then add exercises.
          </div>
        )}
      </div>
    </div>
  );
}
