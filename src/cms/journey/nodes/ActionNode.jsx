import { Mail, Bell, Globe, Send, Gift } from "lucide-react";
import NodeShell from "./NodeShell";
import { useJourney } from "../JourneyContext";
import { ACTION_META, BONUS_KINDS, toBackendPath } from "../graph";

const ICONS = { send_email: Mail, send_push: Bell, send_web_push: Globe, send_brevo: Send, grant_bonus: Gift };
const TONES = {
  send_email: "bg-brand-50 text-brand-500",
  send_push: "bg-feather-50 text-feather-600",
  send_web_push: "bg-feather-50 text-feather-600",
  send_brevo: "bg-purple-50 text-purple-600",
  grant_bonus: "bg-gold-50 text-gold-600",
};

function summaryFor(step) {
  const p = step.params || {};
  switch (step.action) {
    case "send_email": return p.subject?.trim() || "(no subject)";
    case "send_push": return p.title?.trim() || "(no title)";
    case "send_web_push": return p.title?.trim() || "(no title)";
    case "send_brevo": return p.event_name?.trim() || "(no event name)";
    case "grant_bonus": {
      const kind = BONUS_KINDS.find((k) => k.value === p.kind)?.label || p.kind || "gems";
      return `+${p.amount ?? 0} ${kind}`;
    }
    default: return "";
  }
}

function statFor(step, stats) {
  if (!stats) return null;
  const { reached, opened, clicked } = stats;
  if (!reached) return null;
  if (step.action === "send_email") {
    const openPct = Math.round(((opened || 0) / reached) * 100);
    const clickPct = Math.round(((clicked || 0) / reached) * 100);
    return `${reached} sent · ${openPct}% opened · ${clickPct}% clicked`;
  }
  return `${reached} sent`;
}

export default function ActionNode({ data }) {
  const { onOpenStep, onRemoveStep, stepStats } = useJourney();
  const meta = ACTION_META[data.step.action];
  const stats = stepStats?.[toBackendPath(data.path)];
  return (
    <NodeShell
      path={data.path}
      icon={ICONS[data.step.action] || Mail}
      tone={TONES[data.step.action] || "bg-slate-100 text-slate-500"}
      label={meta?.label || "Action"}
      summary={summaryFor(data.step)}
      stat={statFor(data.step, stats)}
      onClick={() => onOpenStep(data.path)}
      onRemove={() => onRemoveStep(data.path)}
    />
  );
}
