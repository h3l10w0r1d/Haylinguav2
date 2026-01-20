// src/cms/ExerciseEditor.jsx
import { useEffect, useMemo, useState } from "react";
import { cmsApi } from "./api";
import { Save, Trash2, Braces, Plus, ArrowUpDown } from "lucide-react";

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
        "w-full rounded-xl px-3 py-2 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm min-h-[90px]",
        props.className
      )}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-xl px-3 py-2 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
    />
  );
}

function toJsonText(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function safeParseJson(text) {
  try {
    const v = JSON.parse(text || "{}");
    if (v && typeof v === "object") return { ok: true, value: v };
    return { ok: false, error: "Config JSON must be an object." };
  } catch (e) {
    return { ok: false, error: e.message || "Invalid JSON" };
  }
}

const KIND_OPTIONS = [
  { kind: "char_intro", label: "Char intro (info screen)" },
  { kind: "letter_recognition", label: "Letter recognition (MCQ)" },
  { kind: "letter_typing", label: "Letter typing" },
  // Add more here later when you implement them in ExerciseRenderer
];

function defaultConfigForKind(kind) {
  if (kind === "char_intro") {
    return {
      letter: "Լ",
      lower: "լ",
      transliteration: "l",
      hint: "Like the English sound 'l'",
      examples: [{ en: "Moon", hy: "Լուսին" }],
    };
  }
  if (kind === "letter_recognition") {
    return {
      choices: ["Ա", "Լ", "Կ", "Մ"],
    };
  }
  if (kind === "letter_typing") {
    return {
      keyboard_hint: "It looks like a tall hook.",
    };
  }
  return {};
}

/**
 * Props:
 *  - lessonId: required for create mode
 *  - exercise: exercise object or null (null means create mode)
 *  - onSaved(msg?)
 *  - onDeleted(msg?)
 */
export default function ExerciseEditor({ lessonId, exercise, onSaved, onDeleted }) {
  const isEdit = !!exercise?.id;

  const [form, setForm] = useState({
    kind: "char_intro",
    prompt: "",
    expected_answer: "",
    order: 1,
    sentence_before: "",
    sentence_after: "",
  });

  // We keep config as TEXT for editing, but we always validate before saving.
  const [configText, setConfigText] = useState("{}");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [showConfigHelper, setShowConfigHelper] = useState(true);

  // When switching exercise, hydrate form
  useEffect(() => {
    setErr("");

    if (exercise) {
      setForm({
        kind: exercise.kind || "char_intro",
        prompt: exercise.prompt || "",
        expected_answer: exercise.expected_answer ?? "",
        order: exercise.order ?? 1,
        sentence_before: exercise.sentence_before ?? "",
        sentence_after: exercise.sentence_after ?? "",
      });

      // exercise.config can be null, object, or string depending on backend
      let cfg = exercise.config;
      if (typeof cfg === "string") {
        // might already be JSON string
        const parsed = safeParseJson(cfg);
        setConfigText(parsed.ok ? toJsonText(parsed.value) : cfg);
      } else {
        setConfigText(toJsonText(cfg || {}));
      }
    } else {
      // create mode defaults
      setForm({
        kind: "char_intro",
        prompt: "New exercise",
        expected_answer: "",
        order: 1,
        sentence_before: "",
        sentence_after: "",
      });
      setConfigText(toJsonText(defaultConfigForKind("char_intro")));
    }
  }, [exercise?.id]);

  // Derived parsed config state
  const parsedConfig = useMemo(() => safeParseJson(configText), [configText]);

  function validate() {
    if (!cmsApi) return "CMS API not initialized. Open CMS through token route.";

    if (!lessonId && !isEdit) return "Select a lesson first (needed to create an exercise).";

    const kind = String(form.kind || "").trim();
    const prompt = String(form.prompt || "").trim();

    if (!kind) return "Kind is required.";
    if (!prompt) return "Prompt is required.";

    const order = Number(form.order);
    if (!Number.isFinite(order) || order < 1) return "Order must be a number >= 1.";

    // Config JSON must be valid
    if (!parsedConfig.ok) return `Config JSON error: ${parsedConfig.error}`;

    // Kind-specific validations (minimal but useful)
    if (kind === "letter_recognition") {
      const choices = parsedConfig.value?.choices;
      if (!Array.isArray(choices) || choices.length < 2) {
        return "letter_recognition requires config.choices with at least 2 items.";
      }
      const exp = String(form.expected_answer || "").trim();
      if (!exp) return "letter_recognition requires expected_answer (the correct choice).";
      let found = false;
      for (let i = 0; i < choices.length; i++) {
        if (String(choices[i]) === exp) found = true;
      }
      if (!found) return "expected_answer must be one of config.choices.";
    }

    if (kind === "letter_typing") {
      const exp = String(form.expected_answer || "").trim();
      if (!exp) return "letter_typing requires expected_answer (the correct letter).";
    }

    // char_intro can have expected_answer null/empty
    return "";
  }

  function applyDefaultConfig() {
    const cfg = defaultConfigForKind(form.kind);
    setConfigText(toJsonText(cfg));
  }

  function buildHelpersUI() {
    if (!showConfigHelper) return null;

    // Provide a kind-aware helper panel that edits configText safely
    const kind = form.kind;

    if (kind === "char_intro") {
      const cfg = parsedConfig.ok ? parsedConfig.value : {};
      const letter = cfg.letter ?? "";
      const lower = cfg.lower ?? "";
      const transliteration = cfg.transliteration ?? "";
      const hint = cfg.hint ?? "";
      const examples = Array.isArray(cfg.examples) ? cfg.examples : [];

      function setCfg(next) {
        setConfigText(toJsonText(next));
      }

      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Char intro builder</div>
            <button
              type="button"
              onClick={applyDefaultConfig}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50"
            >
              Reset preset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Letter (uppercase)">
              <Input
                value={letter}
                onChange={(e) => setCfg({ ...cfg, letter: e.target.value })}
                placeholder="Լ"
              />
            </Field>
            <Field label="Letter (lowercase)">
              <Input
                value={lower}
                onChange={(e) => setCfg({ ...cfg, lower: e.target.value })}
                placeholder="լ"
              />
            </Field>
            <Field label="Transliteration">
              <Input
                value={transliteration}
                onChange={(e) => setCfg({ ...cfg, transliteration: e.target.value })}
                placeholder="l"
              />
            </Field>
            <Field label="Hint">
              <Input
                value={hint}
                onChange={(e) => setCfg({ ...cfg, hint: e.target.value })}
                placeholder="Like the English sound 'l'"
              />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500">Examples</div>

            {examples.length === 0 ? (
              <div className="text-sm text-slate-500">No examples.</div>
            ) : (
              <div className="space-y-2">
                {examples.map((ex, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input
                      value={ex.en ?? ""}
                      onChange={(e) => {
                        const next = examples.slice();
                        next[idx] = { ...next[idx], en: e.target.value };
                        setCfg({ ...cfg, examples: next });
                      }}
                      placeholder="English"
                    />
                    <Input
                      value={ex.hy ?? ""}
                      onChange={(e) => {
                        const next = examples.slice();
                        next[idx] = { ...next[idx], hy: e.target.value };
                        setCfg({ ...cfg, examples: next });
                      }}
                      placeholder="Armenian"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const next = examples.slice();
                next.push({ en: "", hy: "" });
                setCfg({ ...cfg, examples: next });
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              Add example
            </button>
          </div>
        </div>
      );
    }

    if (kind === "letter_recognition") {
      const cfg = parsedConfig.ok ? parsedConfig.value : {};
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];

      function setChoices(nextChoices) {
        setConfigText(toJsonText({ ...cfg, choices: nextChoices }));
      }

      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">MCQ builder</div>
            <button
              type="button"
              onClick={applyDefaultConfig}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50"
            >
              Reset preset
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-500">
              Choices (expected_answer must match one of these)
            </div>

            {choices.length === 0 ? (
              <div className="text-sm text-slate-500">No choices.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {choices.map((c, idx) => (
                  <Input
                    key={idx}
                    value={String(c)}
                    onChange={(e) => {
                      const next = choices.slice();
                      next[idx] = e.target.value;
                      setChoices(next);
                    }}
                    placeholder={`Choice ${idx + 1}`}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = choices.slice();
                  next.push("");
                  setChoices(next);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
              >
                <Plus className="w-4 h-4" />
                Add choice
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = choices.slice().reverse();
                  setChoices(next);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50"
              >
                <ArrowUpDown className="w-4 h-4" />
                Reverse
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (kind === "letter_typing") {
      const cfg = parsedConfig.ok ? parsedConfig.value : {};
      const keyboard_hint = cfg.keyboard_hint ?? "";

      function setCfg(next) {
        setConfigText(toJsonText(next));
      }

      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Typing builder</div>
            <button
              type="button"
              onClick={applyDefaultConfig}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50"
            >
              Reset preset
            </button>
          </div>

          <Field label="Keyboard hint">
            <Input
              value={keyboard_hint}
              onChange={(e) => setCfg({ ...cfg, keyboard_hint: e.target.value })}
              placeholder="It looks like a tall hook."
            />
          </Field>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No helper for this kind yet. Edit config JSON manually.
      </div>
    );
  }

  async function save() {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setSaving(true);
    setErr("");

    try {
      const configObj = parsedConfig.value;

      const payload = {
        kind: String(form.kind).trim(),
        prompt: String(form.prompt).trim(),
        expected_answer:
          form.kind === "char_intro"
            ? null
            : String(form.expected_answer ?? "").trim(),
        order: Number(form.order),
        sentence_before: form.sentence_before ? String(form.sentence_before) : null,
        sentence_after: form.sentence_after ? String(form.sentence_after) : null,
        config: configObj,
      };

      if (isEdit) {
        await cmsApi.updateExercise(exercise.id, payload);
        onSaved?.("Exercise updated");
      } else {
        await cmsApi.createExercise(lessonId, payload);
        onSaved?.("Exercise created");
      }
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!cmsApi) {
      setErr("CMS API not initialized. Open CMS through token route.");
      return;
    }
    if (!isEdit) return;

    if (!confirm("Delete this exercise?")) return;

    setSaving(true);
    setErr("");

    try {
      await cmsApi.deleteExercise(exercise.id);
      onDeleted?.("Exercise deleted");
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

      {!lessonId && !isEdit ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-sm font-semibold">
          Select a lesson first to create an exercise.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Kind" hint="Must match your ExerciseRenderer kinds.">
          <Select
            value={form.kind}
            onChange={(e) => {
              const kind = e.target.value;
              setForm((prev) => ({
                ...prev,
                kind,
                // expected answer defaults per kind
                expected_answer: kind === "char_intro" ? "" : prev.expected_answer,
              }));
              // When kind changes in create mode, apply preset
              if (!isEdit) setConfigText(toJsonText(defaultConfigForKind(kind)));
            }}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Order" hint="Defines sequence inside lesson. Start from 1.">
          <Input
            type="number"
            value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value })}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Prompt">
            <Textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              placeholder="Meet your first Armenian letter Լ!"
            />
          </Field>
        </div>

        <Field
          label="Expected answer"
          hint={
            form.kind === "char_intro"
              ? "Not needed for char_intro (will be saved as null)."
              : "Correct answer for this exercise."
          }
        >
          <Input
            value={form.expected_answer}
            onChange={(e) => setForm({ ...form, expected_answer: e.target.value })}
            placeholder={form.kind === "letter_recognition" ? "Լ" : "Type answer…"}
            disabled={form.kind === "char_intro"}
          />
        </Field>

        <Field label="Sentence before (optional)">
          <Input
            value={form.sentence_before}
            onChange={(e) => setForm({ ...form, sentence_before: e.target.value })}
            placeholder="Optional context before exercise"
          />
        </Field>

        <Field label="Sentence after (optional)">
          <Input
            value={form.sentence_after}
            onChange={(e) => setForm({ ...form, sentence_after: e.target.value })}
            placeholder="Optional context after exercise"
          />
        </Field>
      </div>

      {/* Config helper + raw JSON */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Braces className="w-4 h-4" />
              Config
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Stored as JSON in SQL. Helper edits it safely.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfigHelper((v) => !v)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50"
          >
            {showConfigHelper ? "Hide helper" : "Show helper"}
          </button>
        </div>

        {buildHelpersUI()}

        <Field
          label="Raw config JSON"
          hint={parsedConfig.ok ? "Valid JSON" : `Invalid JSON: ${parsedConfig.error}`}
        >
          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            className={cx(
              "w-full rounded-2xl px-3 py-2 border bg-white font-mono text-xs min-h-[180px] focus:outline-none focus:ring-2",
              parsedConfig.ok
                ? "border-slate-200 focus:ring-orange-300"
                : "border-red-300 focus:ring-red-200"
            )}
          />
        </Field>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || (!lessonId && !isEdit)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create exercise"}
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
            Tip: For MCQ kinds, set config.choices and ensure expected_answer matches one of them.
          </div>
        )}
      </div>
    </div>
  );
}
