import { Clock } from "lucide-react";
import NodeShell from "./NodeShell";
import { useJourney } from "../JourneyContext";

export default function WaitNode({ data }) {
  const { onOpenStep, onRemoveStep } = useJourney();
  const hours = data.step.duration_hours ?? 24;
  return (
    <NodeShell
      path={data.path}
      icon={Clock}
      tone="bg-gold-50 text-gold-600"
      label="Wait"
      summary={`${hours} hour${hours === 1 ? "" : "s"}`}
      onClick={() => onOpenStep(data.path)}
      onRemove={() => onRemoveStep(data.path)}
    />
  );
}
