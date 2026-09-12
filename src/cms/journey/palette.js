// src/cms/journey/palette.js — the draggable/clickable step-kind list
// shown in JourneyCanvas's sidebar, driving both drag-to-insert (dnd-kit)
// and click-to-insert on an AddStepNode.
import { Mail, Bell, Globe, Send, Gift, Clock, GitBranch, Shuffle } from "lucide-react";

export const PALETTE = [
  { kind: "wait", label: "Wait", icon: Clock, tone: "bg-gold-50 text-gold-600" },
  { kind: "condition", label: "Condition", icon: GitBranch, tone: "bg-cardinal-50 text-cardinal-600" },
  { kind: "split", label: "A/B split", icon: Shuffle, tone: "bg-purple-50 text-purple-600" },
  { kind: "send_email", label: "Email", icon: Mail, tone: "bg-brand-50 text-brand-500" },
  { kind: "send_push", label: "Push (app)", icon: Bell, tone: "bg-feather-50 text-feather-600" },
  { kind: "send_web_push", label: "Push (web)", icon: Globe, tone: "bg-feather-50 text-feather-600" },
  { kind: "send_brevo", label: "Brevo", icon: Send, tone: "bg-purple-50 text-purple-600" },
  { kind: "grant_bonus", label: "Bonus", icon: Gift, tone: "bg-gold-50 text-gold-600" },
];

export function paletteMetaFor(kind) {
  return PALETTE.find((p) => p.kind === kind);
}
