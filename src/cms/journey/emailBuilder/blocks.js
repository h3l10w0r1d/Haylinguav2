// src/cms/journey/emailBuilder/blocks.js — the drag-and-drop email builder's
// data model + HTML compiler. Blocks live in params.blocks (send_email
// action, backend never validates params shape — see automations.py's
// _validate_steps, only step.type/action are checked, so this is purely
// additive and safe); compileBlocksToHtml() writes the result into
// params.html_body, which _action_send_email already sends as-is (with
// {{variable}} substitution happening server-side at send time — the
// compiler here must NOT touch {{...}} tokens).
import { Image, Heading as HeadingIcon, Type, MousePointerClick, Minus, MoveVertical } from "lucide-react";

export const BLOCK_TYPES = [
  { type: "banner", label: "Banner", icon: Image },
  { type: "heading", label: "Heading", icon: HeadingIcon },
  { type: "text", label: "Text", icon: Type },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Spacer", icon: MoveVertical },
];

// Matches tailwind.config.cjs's brand palette — kept as literal hex since
// compiled email HTML can't reference Tailwind/CSS-variable classes (email
// clients strip <style>/external CSS in most inboxes; inline hex is the
// only reliably-rendering option).
export const COLOR_PRESETS = [
  "#FFFFFF", "#FFF5EC", "#FF7A1A", "#E7F7FF", "#1CB0F6", "#FFF8E1", "#F1F5F9", "#0F172A",
];

function uid() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function newBlock(type) {
  const id = uid();
  switch (type) {
    case "banner": return { id, type, imageUrl: "", linkUrl: "", alt: "", bg: "#FFFFFF" };
    case "heading": return { id, type, text: "Big news, {{first_name}}!", size: "lg", color: "#0F172A", align: "left", bg: "#FFFFFF" };
    case "text": return { id, type, text: "Hi {{first_name}}, ...", color: "#334155", align: "left", bg: "#FFFFFF" };
    case "button": return { id, type, label: "Open Haylingua", url: "https://www.haylingua.am", color: "#FF7A1A", textColor: "#FFFFFF", align: "left", bg: "#FFFFFF" };
    case "divider": return { id, type, color: "#F1F5F9", bg: "#FFFFFF" };
    case "spacer": return { id, type, height: 24, bg: "#FFFFFF" };
    default: return { id, type, bg: "#FFFFFF" };
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function renderBlock(b) {
  const bg = b.bg || "#FFFFFF";
  switch (b.type) {
    case "banner": {
      if (!b.imageUrl) return "";
      const img = `<img src="${escapeAttr(b.imageUrl)}" alt="${escapeAttr(b.alt)}" style="width:100%;display:block;border-radius:16px;" />`;
      return `<div style="background:${bg};padding:20px;">${b.linkUrl ? `<a href="${escapeAttr(b.linkUrl)}">${img}</a>` : img}</div>`;
    }
    case "heading":
      return `<div style="background:${bg};padding:20px 20px 4px;text-align:${b.align || "left"};"><h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:${b.size === "xl" ? "28px" : "22px"};font-weight:800;color:${b.color || "#0F172A"};">${escapeHtml(b.text)}</h1></div>`;
    case "text":
      return `<div style="background:${bg};padding:8px 20px 20px;text-align:${b.align || "left"};"><p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:${b.color || "#334155"};white-space:pre-wrap;">${escapeHtml(b.text)}</p></div>`;
    case "button":
      return `<div style="background:${bg};padding:12px 20px 24px;text-align:${b.align || "left"};"><a href="${escapeAttr(b.url || "#")}" style="display:inline-block;padding:12px 28px;border-radius:9999px;background:${b.color || "#FF7A1A"};color:${b.textColor || "#FFFFFF"};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:700;font-size:14px;text-decoration:none;">${escapeHtml(b.label)}</a></div>`;
    case "divider":
      return `<div style="background:${bg};padding:0 20px;"><div style="height:2px;border-radius:2px;background:${b.color || "#F1F5F9"};line-height:2px;font-size:0;">&nbsp;</div></div>`;
    case "spacer":
      return `<div style="background:${bg};height:${b.height || 24}px;line-height:${b.height || 24}px;font-size:0;">&nbsp;</div>`;
    default:
      return "";
  }
}

export function compileBlocksToHtml(blocks) {
  const inner = (blocks || []).map(renderBlock).filter(Boolean).join("\n");
  return `<div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:20px;overflow:hidden;">${inner}</div>`;
}
