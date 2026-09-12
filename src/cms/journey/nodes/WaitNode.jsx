import { Clock } from "lucide-react";
import NodeShell from "./NodeShell";
import { useJourney } from "../JourneyContext";
import { toBackendPath } from "../graph";

export default function WaitNode({ data }) {
  const { onOpenStep, onRemoveStep, stepStats } = useJourney();
  const hours = data.step.duration_hours ?? 24;
  const waitingNow = stepStats?.[toBackendPath(data.path)]?.waiting_now;
  return (
    <NodeShell
      path={data.path}
      icon={Clock}
      tone="bg-gold-50 text-gold-600"
      label="Wait"
      summary={`${hours} hour${hours === 1 ? "" : "s"}`}
      stat={waitingNow ? `${waitingNow} waiting here now` : null}
      onClick={() => onOpenStep(data.path)}
      onRemove={() => onRemoveStep(data.path)}
    />
  );
}
