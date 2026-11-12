import type { BuildStep, Part, SetProgress } from "./types";

export function emptyProgress(): SetProgress {
  return { currentStepId: null, checkedByStep: {} };
}

export function stepIndex(steps: Pick<BuildStep, "id">[], currentStepId: string | null): number {
  if (steps.length === 0) return 0;
  if (!currentStepId) return 0;
  const index = steps.findIndex((step) => step.id === currentStepId);
  return index === -1 ? 0 : index;
}

export function goNext(steps: Pick<BuildStep, "id">[], progress: SetProgress): SetProgress {
  if (steps.length === 0) return { ...progress, currentStepId: null };
  const index = Math.min(stepIndex(steps, progress.currentStepId) + 1, steps.length - 1);
  return { ...progress, currentStepId: steps[index].id };
}

export function goBack(steps: Pick<BuildStep, "id">[], progress: SetProgress): SetProgress {
  if (steps.length === 0) return { ...progress, currentStepId: null };
  const index = Math.max(stepIndex(steps, progress.currentStepId) - 1, 0);
  return { ...progress, currentStepId: steps[index].id };
}

export function jumpTo(steps: Pick<BuildStep, "id">[], progress: SetProgress, index: number): SetProgress {
  if (steps.length === 0) return { ...progress, currentStepId: null };
  const clamped = Math.min(Math.max(Math.trunc(index), 0), steps.length - 1);
  return { ...progress, currentStepId: steps[clamped].id };
}

/** Swipe left to advance, swipe right to go back. Vertical drags are ignored. */
export function swipeDirection(dx: number, dy: number, threshold = 48): "next" | "back" | null {
  if (Math.abs(dx) < threshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? "next" : "back";
}

export function applySwipe(
  steps: Pick<BuildStep, "id">[],
  progress: SetProgress,
  dx: number,
  dy: number,
): SetProgress {
  const direction = swipeDirection(dx, dy);
  if (direction === "next") return goNext(steps, progress);
  if (direction === "back") return goBack(steps, progress);
  return progress;
}

export function togglePart(progress: SetProgress, stepId: string, partId: string): SetProgress {
  const current = progress.checkedByStep[stepId] ?? [];
  const next = current.includes(partId)
    ? current.filter((id) => id !== partId)
    : [...current, partId];
  return {
    ...progress,
    checkedByStep: { ...progress.checkedByStep, [stepId]: next },
  };
}

export function isPartChecked(progress: SetProgress, stepId: string, partId: string): boolean {
  return (progress.checkedByStep[stepId] ?? []).includes(partId);
}

export function progressFraction(steps: Pick<BuildStep, "id">[], currentStepId: string | null): number {
  if (steps.length === 0) return 0;
  return (stepIndex(steps, currentStepId) + 1) / steps.length;
}

export function allPartsChecked(step: Pick<BuildStep, "parts">, checkedIds: string[]): boolean {
  return step.parts.length > 0 && step.parts.every((part) => checkedIds.includes(part.id));
}

export function stepNeedsAttention(step: Pick<BuildStep, "placementCertainty" | "parts">): boolean {
  return step.placementCertainty === "uncertain" || step.parts.some((part) => part.certainty === "uncertain");
}

export function reconcileProgress(progress: SetProgress, steps: BuildStep[]): SetProgress {
  const checkedByStep: Record<string, string[]> = {};
  for (const step of steps) {
    const allowed = new Set(step.parts.map((part) => part.id));
    const kept = (progress.checkedByStep[step.id] ?? []).filter((id) => allowed.has(id));
    if (kept.length > 0) checkedByStep[step.id] = kept;
  }
  const known = new Set(steps.map((step) => step.id));
  let currentStepId = progress.currentStepId;
  if (currentStepId && !known.has(currentStepId)) {
    currentStepId = steps[0]?.id ?? null;
  }
  return { currentStepId, checkedByStep };
}

export function checkedIds(progress: SetProgress, stepId: string): string[] {
  return progress.checkedByStep[stepId] ?? [];
}

export function partById(step: BuildStep, partId: string): Part | undefined {
  return step.parts.find((part) => part.id === partId);
}
