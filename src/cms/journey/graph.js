// src/cms/journey/graph.js — pure, framework-agnostic conversion between
// the automation engine's step-tree JSON (backend/automations.py) and a
// React Flow {nodes, edges} graph, plus the mutation helpers the canvas
// uses to edit that tree by path instead of by array splice-in-place.
//
// Path encoding (internal only — never serialized, never sent to the
// backend): a dotted string of alternating tokens, "<index>(.b<branch
// index>.<index>)*", e.g. "2" (root steps[2]), "0.b1.2"
// (steps[0].branches[1].steps[2]). A step's own path IS its identity for
// editing purposes here — same positional-path concept
// backend/automations.py already uses for waiting_step_path/dedup, just
// disambiguating branch hops with a "bN" token since a condition step's
// children live under branches[i].steps, not a single flat list.
//
// An "insertion path" uses the same grammar but the final index addresses
// a position *between* siblings (0..length, inclusive) rather than an
// existing step.
import dagre from "dagre";

export const ACTION_KINDS = ["send_email", "send_push", "send_web_push", "send_brevo", "grant_bonus"];

export const ACTION_META = {
  send_email: { label: "Send email" },
  send_push: { label: "Send push (mobile app)" },
  send_web_push: { label: "Send push (web browser)" },
  send_brevo: { label: "Send to Brevo" },
  grant_bonus: { label: "Grant bonus" },
};

export const BONUS_KINDS = [
  { value: "gems", label: "Gems" },
  { value: "xp", label: "XP" },
  { value: "chests", label: "Chests" },
  { value: "streak_freeze", label: "Streak freeze" },
];

export function defaultParams(action) {
  switch (action) {
    case "send_email": return { subject: "", body: "" };
    case "send_push": return { title: "", body: "" };
    case "send_web_push": return { title: "", body: "", url: "" };
    case "send_brevo": return { event_name: "" };
    case "grant_bonus": return { kind: "gems", amount: 50, notify_email: false, notify_inapp: true, message: "" };
    default: return {};
  }
}

export function newStep(kind) {
  if (kind === "wait") return { type: "wait", duration_hours: 24 };
  if (kind === "condition") return { type: "condition", branches: [{ when: [], steps: [] }, { else: true, steps: [] }] };
  if (kind === "split") return { type: "split", branches: [{ weight: 50, steps: [] }, { weight: 50, steps: [] }] };
  return { type: "action", action: kind, params: defaultParams(kind) };
}

export function nodeKindOf(step) {
  if (step.type === "condition") return "condition";
  if (step.type === "split") return "split";
  if (step.type === "wait") return "wait";
  return "action";
}

function parsePathTokens(path) {
  if (path === "" || path == null) return [];
  return String(path).split(".");
}

// Rebuilds `steps` down to the container array addressed by `tokens`
// (all tokens except the last, which addresses a position/index *within*
// that container), calling `updater(container, index)` to produce the new
// container, and splicing the result back up through fresh copies of every
// ancestor (never mutates the input tree).
function updateContainerAtPath(steps, tokens, updater) {
  if (tokens.length <= 1) {
    const index = Number(tokens[0] ?? 0);
    return updater(Array.isArray(steps) ? steps : [], index);
  }
  const stepIdx = Number(tokens[0]);
  const branchTok = tokens[1];
  const branchIdx = Number(branchTok.slice(1));
  return steps.map((step, i) => {
    if (i !== stepIdx) return step;
    const branches = Array.isArray(step.branches) ? step.branches : [];
    const nextBranches = branches.map((b, bi) => {
      if (bi !== branchIdx) return b;
      const childSteps = Array.isArray(b.steps) ? b.steps : [];
      return { ...b, steps: updateContainerAtPath(childSteps, tokens.slice(2), updater) };
    });
    return { ...step, branches: nextBranches };
  });
}

export function getStepAtPath(steps, path) {
  const tokens = parsePathTokens(path);
  let container = Array.isArray(steps) ? steps : [];
  for (let i = 0; i < tokens.length - 1; i += 2) {
    const step = container[Number(tokens[i])];
    if (!step) return undefined;
    const branchIdx = Number(tokens[i + 1].slice(1));
    container = step.branches?.[branchIdx]?.steps || [];
  }
  return container[Number(tokens[tokens.length - 1])];
}

function spliceStepIn(steps, insertionPath, stepObj) {
  const tokens = parsePathTokens(insertionPath);
  return updateContainerAtPath(steps, tokens, (container, index) => {
    const next = container.slice();
    next.splice(Math.max(0, Math.min(index, next.length)), 0, stepObj);
    return next;
  });
}

export function insertStepAtPath(steps, insertionPath, kind) {
  return spliceStepIn(steps, insertionPath, newStep(kind));
}

export function removeStepAtPath(steps, path) {
  const tokens = parsePathTokens(path);
  const index = Number(tokens[tokens.length - 1]);
  return updateContainerAtPath(steps, tokens, (container) => container.filter((_, i) => i !== index));
}

function replaceStepAtPath(steps, path, fn) {
  const tokens = parsePathTokens(path);
  const index = Number(tokens[tokens.length - 1]);
  return updateContainerAtPath(steps, tokens, (container) =>
    container.map((s, i) => (i === index ? fn(s) : s))
  );
}

export function updateStepAtPath(steps, path, patch) {
  return replaceStepAtPath(steps, path, (s) => ({ ...s, ...patch }));
}

export function addBranch(steps, conditionPath) {
  return replaceStepAtPath(steps, conditionPath, (step) => {
    const branches = Array.isArray(step.branches) ? step.branches : [];
    const elseIdx = branches.findIndex((b) => b.else);
    const insertAt = elseIdx === -1 ? branches.length : elseIdx;
    const next = branches.slice();
    next.splice(insertAt, 0, { when: [], steps: [] });
    return { ...step, branches: next };
  });
}

export function removeBranch(steps, conditionPath, branchIndex) {
  return replaceStepAtPath(steps, conditionPath, (step) => {
    const branches = Array.isArray(step.branches) ? step.branches : [];
    return { ...step, branches: branches.filter((_, i) => i !== branchIndex) };
  });
}

// Split branches are shaped differently from condition branches ({weight,
// steps} vs {when, steps} with an else-index special case) — a separate
// pair of helpers rather than overloading addBranch/removeBranch, so a
// SplitNode can never accidentally insert a condition-shaped branch (or
// vice versa).
// Both add/remove normalize weights back to summing 100 in the SAME
// pure-function call (not a separate onChange dispatch after) — a
// caller that fired addSplitBranch then normalizeSplitWeights as two
// back-to-back onChange calls in one event handler would have the second
// call's closure read the pre-add `steps`, silently undoing the add
// (classic same-render stale-closure double-dispatch).
export function addSplitBranch(steps, splitPath) {
  return replaceStepAtPath(steps, splitPath, (step) => {
    const branches = Array.isArray(step.branches) ? step.branches : [];
    const next = [...branches, { weight: 0, steps: [] }];
    const even = Math.round((100 / next.length) * 10) / 10;
    return { ...step, branches: next.map((b) => ({ ...b, weight: even })) };
  });
}

export function removeSplitBranch(steps, splitPath, branchIndex) {
  return replaceStepAtPath(steps, splitPath, (step) => {
    const branches = Array.isArray(step.branches) ? step.branches : [];
    const next = branches.filter((_, i) => i !== branchIndex);
    const total = next.reduce((sum, b) => sum + (Number(b.weight) || 0), 0);
    if (total <= 0) return { ...step, branches: next };
    return { ...step, branches: next.map((b) => ({ ...b, weight: Math.round(((Number(b.weight) || 0) / total) * 1000) / 10 })) };
  });
}

export function updateSplitBranchWeight(steps, splitPath, branchIndex, weight) {
  return replaceStepAtPath(steps, splitPath, (step) => {
    const branches = Array.isArray(step.branches) ? step.branches : [];
    return { ...step, branches: branches.map((b, i) => (i === branchIndex ? { ...b, weight } : b)) };
  });
}

// Rescales every branch's weight so they sum to 100 — called on blur after
// a weight edit rather than on every keystroke, so typing "5" toward "50"
// doesn't fight the user mid-edit. Falls back to an even split if every
// weight is currently 0/blank (e.g. right after adding a branch).
export function normalizeSplitWeights(steps, splitPath) {
  return replaceStepAtPath(steps, splitPath, (step) => {
    const branches = Array.isArray(step.branches) ? step.branches : [];
    const total = branches.reduce((sum, b) => sum + (Number(b.weight) || 0), 0);
    if (total <= 0) {
      const even = Math.round((100 / (branches.length || 1)) * 10) / 10;
      return { ...step, branches: branches.map((b) => ({ ...b, weight: even })) };
    }
    return {
      ...step,
      branches: branches.map((b) => ({ ...b, weight: Math.round(((Number(b.weight) || 0) / total) * 1000) / 10 })),
    };
  });
}

// A move would corrupt the tree if the drop target lives inside the
// subtree of the step being moved (e.g. dragging a condition into one of
// its own branches) — every container path nested under a step's subtree
// literally starts with that step's own path + ".b" (branch hop token),
// since path segments are a strict positional walk with no other way to
// re-enter a subtree, so a string-prefix check is sufficient and exact.
function isWithinOwnSubtree(stepPath, containerPath) {
  return containerPath === stepPath || containerPath.startsWith(`${stepPath}.b`);
}

export function moveStep(steps, fromPath, toInsertionPath) {
  const fromTokens = parsePathTokens(fromPath);
  const toTokens = parsePathTokens(toInsertionPath);
  const toContainerPath = toTokens.slice(0, -1).join(".");
  if (isWithinOwnSubtree(fromPath, toContainerPath)) {
    return { steps, blocked: true };
  }
  const moved = getStepAtPath(steps, fromPath);
  if (!moved) return { steps, blocked: false };

  const afterRemoval = removeStepAtPath(steps, fromPath);

  // Removing `fromPath` can shift sibling indices within the SAME
  // container the drop target lives in — adjust the target index down by
  // one when the removed sibling sat before it.
  const fromContainerPath = fromTokens.slice(0, -1).join(".");
  const fromIndex = Number(fromTokens[fromTokens.length - 1]);
  let toIndex = Number(toTokens[toTokens.length - 1]);
  if (fromContainerPath === toContainerPath && fromIndex < toIndex) toIndex -= 1;
  const adjustedInsertionPath = [...toTokens.slice(0, -1), String(toIndex)].join(".");

  return { steps: spliceStepIn(afterRemoval, adjustedInsertionPath, moved), blocked: false };
}

// --- steps ⇄ React Flow graph -----------------------------------------

const NODE_SIZE = {
  trigger: { width: 220, height: 64 },
  wait: { width: 200, height: 60 },
  action: { width: 220, height: 68 },
  condition: { width: 240, height: 68 },
  split: { width: 240, height: 68 },
  add: { width: 32, height: 32 },
};

function sizeFor(type, step) {
  const base = NODE_SIZE[type] || NODE_SIZE.action;
  if (type === "condition" || type === "split") {
    const branchCount = Array.isArray(step?.branches) ? step.branches.length : 2;
    return { ...base, height: base.height + Math.max(0, branchCount - 2) * 22 };
  }
  return base;
}

function makeEdge(source, sourceHandle, target) {
  return {
    id: `e:${source}${sourceHandle ? `:${sourceHandle}` : ""}->${target}`,
    source,
    target,
    sourceHandle: sourceHandle || undefined,
    type: "smoothstep",
    animated: false,
  };
}

function walkContainer(list, containerPath, entry, nodes, edges, readOnly) {
  const steps = Array.isArray(list) ? list : [];
  let prev = entry;
  for (let i = 0; i <= steps.length; i += 1) {
    if (!readOnly) {
      const addPath = containerPath ? `${containerPath}.${i}` : `${i}`;
      const addId = `add:${addPath}`;
      nodes.push({ id: addId, type: "add", position: { x: 0, y: 0 }, data: { insertionPath: addPath } });
      edges.push(makeEdge(prev.id, prev.handle, addId));
      prev = { id: addId, handle: undefined };
    }
    if (i < steps.length) {
      const step = steps[i];
      const stepPath = containerPath ? `${containerPath}.${i}` : `${i}`;
      const type = nodeKindOf(step);
      nodes.push({ id: stepPath, type, position: { x: 0, y: 0 }, data: { step, path: stepPath, readOnly } });
      edges.push(makeEdge(prev.id, prev.handle, stepPath));
      prev = { id: stepPath, handle: undefined };
      if (type === "condition" || type === "split") {
        const branches = Array.isArray(step.branches) ? step.branches : [];
        branches.forEach((b, bi) => {
          walkContainer(b.steps, `${stepPath}.b${bi}`, { id: stepPath, handle: `branch-${bi}` }, nodes, edges, readOnly);
        });
      }
    }
  }
}

export function stepsToGraph(steps, { readOnly = false } = {}) {
  // TriggerNode reads its label from JourneyContext (AutomationEditor.jsx
  // already knows whether this is an event or segment trigger and formats
  // accordingly), not from this node's own data — this graph module has
  // no business knowing about event types or segment names.
  const nodes = [{ id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: {} }];
  const edges = [];
  walkContainer(steps, "", { id: "trigger", handle: undefined }, nodes, edges, readOnly);
  return layoutWithDagre(nodes, edges);
}

function layoutWithDagre(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 56, ranksep: 56, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => {
    const { width, height } = sizeFor(n.type, n.data?.step);
    g.setNode(n.id, { width, height });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  const laidOutNodes = nodes.map((n) => {
    const { x, y } = g.node(n.id);
    const { width, height } = sizeFor(n.type, n.data?.step);
    return { ...n, position: { x: x - width / 2, y: y - height / 2 } };
  });
  return { nodes: laidOutNodes, edges };
}
