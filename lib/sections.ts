import { normalizeProgress } from "./player";
import type {
  BrickSet,
  BuildSection,
  BuildStep,
  CombinePoint,
  InstructionPage,
  ParsedSection,
  SetProgress,
} from "./types";

export const COMBINE_STEP_PREFIX = "combine:";

export function defaultCombine(): CombinePoint {
  return {
    description: "No separate joining step was found.",
    certainty: "certain",
    uncertaintyNote: null,
  };
}

export function combineStepId(setId: string): string {
  return `${COMBINE_STEP_PREFIX}${setId}`;
}

export function isCombineStep(step: Pick<BuildStep, "id">): boolean {
  return step.id.startsWith(COMBINE_STEP_PREFIX);
}

export function combineAsStep(set: BrickSet): BuildStep {
  return {
    id: combineStepId(set.id),
    pageId: "",
    stepNumber: 0,
    description: set.combine?.description || defaultCombine().description,
    parts: [],
    region: null,
    placementCertainty: set.combine?.certainty ?? "certain",
    placementNote: set.combine?.uncertaintyNote ?? null,
  };
}

export function playableSteps(set: BrickSet, playerId: string | null): BuildStep[] {
  const ordered = orderSteps(set.pages, set.steps);
  const sections = set.sections ?? [];
  const assigned = sections.some((section) => section.assigneeId);
  let mine = ordered;
  if (assigned && playerId) {
    const ids = new Set(
      sections.filter((section) => section.assigneeId === playerId).flatMap((section) => section.stepIds),
    );
    const filtered = ordered.filter((step) => ids.has(step.id));
    if (filtered.length > 0) mine = filtered;
  }
  if (sections.length >= 2) return [...mine, combineAsStep(set)];
  return mine;
}

export function assignSection(set: BrickSet, sectionId: string, playerId: string | null): BrickSet {
  return {
    ...set,
    sections: set.sections.map((section) =>
      section.id === sectionId ? { ...section, assigneeId: playerId } : section,
    ),
  };
}

/** The builder chooses the cut, so the new section is certain. */
export function splitOffSection(set: BrickSet, fromStepId: string, name: string, newId: string): BrickSet {
  const ordered = orderSteps(set.pages, set.steps);
  const fromIndex = ordered.findIndex((step) => step.id === fromStepId);
  if (fromIndex <= 0) return set;
  const source = set.sections.find((section) => section.stepIds.includes(fromStepId));
  const moving = (source ? ordered.filter((step) => source.stepIds.includes(step.id)) : ordered)
    .filter((step) => ordered.findIndex((item) => item.id === step.id) >= fromIndex)
    .map((step) => step.id);
  if (moving.length === 0) return set;
  const movingSet = new Set(moving);
  const sections = set.sections.length
    ? set.sections.map((section) => ({
        ...section,
        stepIds: section.stepIds.filter((id) => !movingSet.has(id)),
      }))
    : [
        {
          id: `${newId}-rest`,
          name: "First section",
          stepIds: ordered.slice(0, fromIndex).map((step) => step.id),
          assigneeId: null,
          certainty: "certain" as const,
          uncertaintyNote: null,
        },
      ];
  return {
    ...set,
    sections: [
      ...sections.filter((section) => section.stepIds.length > 0),
      {
        id: newId,
        name: name.trim() || "New section",
        stepIds: moving,
        assigneeId: null,
        certainty: "certain",
        uncertaintyNote: null,
      },
    ],
  };
}

export function attachPageSections(
  sections: BuildSection[],
  removedStepIds: Set<string>,
  newSteps: BuildStep[],
  parsed: ParsedSection[],
  id: () => string,
): BuildSection[] {
  const base = sections
    .map((section) => ({
      ...section,
      stepIds: section.stepIds.filter((stepId) => !removedStepIds.has(stepId)),
    }))
    .filter((section) => section.stepIds.length > 0);

  for (const section of parsed) {
    const stepIds = newSteps
      .filter((step) => section.stepNumbers.includes(step.stepNumber))
      .map((step) => step.id);
    if (stepIds.length === 0) continue;
    const name = section.name.trim() || "Whole build";
    const existing = base.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.stepIds = [...existing.stepIds, ...stepIds];
      if (section.certainty === "uncertain") {
        existing.certainty = "uncertain";
        existing.uncertaintyNote = section.uncertaintyNote ?? existing.uncertaintyNote;
      }
      continue;
    }
    base.push({
      id: id(),
      name,
      stepIds,
      assigneeId: null,
      certainty: section.certainty,
      uncertaintyNote: section.uncertaintyNote,
    });
  }
  return base;
}

export function progressFor(set: BrickSet, playerId: string | null): SetProgress {
  if (!playerId) return normalizeProgress(null);
  return normalizeProgress(set.progressByPlayer?.[playerId]);
}

export function savePlayerProgress(set: BrickSet, playerId: string, progress: SetProgress): BrickSet {
  return {
    ...set,
    progressByPlayer: {
      ...set.progressByPlayer,
      [playerId]: { ...normalizeProgress(progress), updatedAt: Date.now() },
    },
  };
}

function orderSteps(pages: Pick<InstructionPage, "id" | "order">[], steps: BuildStep[]): BuildStep[] {
  const rank = new Map(pages.map((page) => [page.id, page.order]));
  return [...steps].sort((a, b) => {
    const pageDelta = (rank.get(a.pageId) ?? 0) - (rank.get(b.pageId) ?? 0);
    if (pageDelta !== 0) return pageDelta;
    return a.stepNumber - b.stepNumber;
  });
}
