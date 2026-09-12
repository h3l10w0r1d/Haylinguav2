// src/cms/journey/JourneyContext.jsx — lets node components (rendered by
// React Flow, several component-levels removed from JourneyCanvas) reach
// the canvas's callbacks without threading them through node `data` (which
// graph.js's pure stepsToGraph() has no business knowing about).
import { createContext, useContext } from "react";

const JourneyContext = createContext({
  readOnly: false,
  stepStats: null,
  onOpenStep: () => {},
  onAddBranch: () => {},
  onRemoveBranch: () => {},
  onAddSplitBranch: () => {},
  onRemoveSplitBranch: () => {},
  onUpdateSplitBranchWeight: () => {},
  onNormalizeSplitWeights: () => {},
  onOpenTrigger: () => {},
});

export const JourneyProvider = JourneyContext.Provider;

export function useJourney() {
  return useContext(JourneyContext);
}
