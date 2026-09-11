import { Mail, Bell, Globe, Send, Gift } from "lucide-react";
import NodeShell from "./NodeShell";
import { useJourney } from "../JourneyContext";
import { ACTION_META, BONUS_KINDS } from "../graph";

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

export default function ActionNode({ data }) {
  const { onOpenStep, onRemoveStep } = useJourney();
  const meta = ACTION_META[data.step.action];
  return (
    <NodeShell
      path={data.path}
      icon={ICONS[data.step.action] || Mail}
      tone={TONES[data.step.action] || "bg-slate-100 text-slate-500"}
      label={meta?.label || "Action"}
      summary={summaryFor(data.step)}
      onClick={() => onOpenStep(data.path)}
      onRemove={() => onRemoveStep(data.path)}
    />
  );
}
