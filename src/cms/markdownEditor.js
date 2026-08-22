// src/cms/markdownEditor.js — pure helpers for CmsBlog.jsx's Markdown
// authoring surface: toolbar actions that wrap/insert text at the textarea's
// current selection, and a lightweight SEO checklist computed straight from
// the draft fields (no external service — this is a Yoast-style live
// analyzer, not a real crawler).

// Wraps the current selection in `before`/`after` (or inserts `placeholder`
// between them if nothing is selected), returns the new full value and
// where the selection should land afterward so the caller can restore focus
// and cursor position on the actual DOM node.
export function wrapSelection(value, selStart, selEnd, before, after, placeholder = "") {
  const selected = value.slice(selStart, selEnd) || placeholder;
  const next = value.slice(0, selStart) + before + selected + after + value.slice(selEnd);
  const from = selStart + before.length;
  const to = from + selected.length;
  return { value: next, selStart: from, selEnd: to };
}

// Inserts `text` at the cursor (or replaces the selection), cursor lands
// right after the inserted text.
export function insertAtCursor(value, selStart, selEnd, text) {
  const next = value.slice(0, selStart) + text + value.slice(selEnd);
  const pos = selStart + text.length;
  return { value: next, selStart: pos, selEnd: pos };
}

// Line-prefix actions (headings, quote) apply to the start of the current
// line rather than wrapping a selection — toggles the prefix off if it's
// already there, matching how most Markdown editors behave.
export function toggleLinePrefix(value, selStart, prefix) {
  const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
  let lineEnd = value.indexOf("\n", selStart);
  if (lineEnd === -1) lineEnd = value.length;
  const line = value.slice(lineStart, lineEnd);
  const has = line.startsWith(prefix);
  const newLine = has ? line.slice(prefix.length) : prefix + line;
  const next = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
  const delta = newLine.length - line.length;
  const pos = Math.max(lineStart, selStart + delta);
  return { value: next, selStart: pos, selEnd: pos };
}

export const TOOLBAR_ACTIONS = [
  { key: "bold", label: "B", title: "Bold", apply: (v, s, e) => wrapSelection(v, s, e, "**", "**", "bold text") },
  { key: "italic", label: "I", title: "Italic", apply: (v, s, e) => wrapSelection(v, s, e, "_", "_", "italic text") },
  { key: "h2", label: "H2", title: "Heading 2", apply: (v, s) => toggleLinePrefix(v, s, "## ") },
  { key: "h3", label: "H3", title: "Heading 3", apply: (v, s) => toggleLinePrefix(v, s, "### ") },
  { key: "quote", label: "”", title: "Quote", apply: (v, s) => toggleLinePrefix(v, s, "> ") },
  { key: "ul", label: "•", title: "Bullet list", apply: (v, s) => toggleLinePrefix(v, s, "- ") },
  { key: "link", label: "🔗", title: "Link", apply: (v, s, e) => wrapSelection(v, s, e, "[", "](https://)", "link text") },
];

// ---------- SEO checklist ----------
// status: "good" | "warn" | "bad"

function wordCount(markdown) {
  const stripped = (markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#*_>`-]/g, " ");
  return stripped.split(/\s+/).filter(Boolean).length;
}

function imagesWithoutAlt(markdown) {
  const matches = [...(markdown || "").matchAll(/!\[([^\]]*)\]\(([^)]*)\)/g)];
  return matches.filter((m) => !m[1].trim()).length;
}

function internalLinkCount(markdown) {
  const matches = [...(markdown || "").matchAll(/\]\((\/[^)]*)\)/g)];
  return matches.length;
}

export function analyzeBlogSeo({ title = "", slug = "", meta_description = "", cover_image_url = "", cover_image_alt = "", body_markdown = "" }) {
  const titleLen = title.trim().length;
  const metaLen = meta_description.trim().length;
  const words = wordCount(body_markdown);
  const hasH2 = /^##\s+\S/m.test(body_markdown || "");
  const badAltCount = imagesWithoutAlt(body_markdown);
  const internalLinks = internalLinkCount(body_markdown);
  const slugOk = !!slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);

  const checks = [
    {
      id: "title-length",
      label: "Title length",
      status: titleLen === 0 ? "bad" : titleLen >= 30 && titleLen <= 60 ? "good" : "warn",
      detail: titleLen === 0 ? "Add a title." : `${titleLen} characters (aim for 30–60).`,
    },
    {
      id: "meta-length",
      label: "Meta description",
      status: metaLen === 0 ? "bad" : metaLen >= 120 && metaLen <= 160 ? "good" : "warn",
      detail: metaLen === 0 ? "Add a meta description — this is what shows in search results." : `${metaLen} characters (aim for 120–160).`,
    },
    {
      id: "slug",
      label: "Slug format",
      status: !slug ? "bad" : slugOk ? "good" : "warn",
      detail: !slug ? "Add a slug." : slugOk ? "Clean, URL-friendly slug." : "Use lowercase letters, numbers, and hyphens only.",
    },
    {
      id: "length",
      label: "Content length",
      status: words === 0 ? "bad" : words >= 300 ? "good" : "warn",
      detail: words === 0 ? "The body is empty." : `${words} words${words < 300 ? " — aim for 300+ for a real article." : "."}`,
    },
    {
      id: "headings",
      label: "Heading structure",
      status: words > 0 && !hasH2 ? "warn" : "good",
      detail: hasH2 ? "Has at least one H2 section heading." : "No H2 (##) headings found — long articles read better broken into sections.",
    },
    {
      id: "cover-alt",
      label: "Cover image alt text",
      status: !cover_image_url ? "warn" : cover_image_alt.trim() ? "good" : "bad",
      detail: !cover_image_url ? "No cover image set." : cover_image_alt.trim() ? "Cover image has alt text." : "Cover image is missing alt text.",
    },
    {
      id: "body-alt",
      label: "Body image alt text",
      status: badAltCount > 0 ? "bad" : "good",
      detail: badAltCount > 0 ? `${badAltCount} image(s) in the body are missing alt text (empty ![]() brackets).` : "All body images have alt text.",
    },
    {
      id: "internal-links",
      label: "Internal links",
      status: internalLinks === 0 ? "warn" : "good",
      detail: internalLinks === 0 ? "No internal links yet — link to another Haylingua page (e.g. /armenian-alphabet)." : `${internalLinks} internal link(s).`,
    },
  ];

  const score = checks.filter((c) => c.status === "good").length;
  return { checks, score, total: checks.length };
}
