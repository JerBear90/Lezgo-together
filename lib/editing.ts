import { canMarkPartCertain } from "./labels";
import { unknownPlacement } from "./placement";
import { emptyProgress, reconcileProgress } from "./player";
import { splitRegion, unionRegion } from "./region";
import type {
  BrickSet,
  BuildStep,
  Certainty,
  InstructionPage,
  Part,
  ParsedExtraction,
  PartPlacement,
  PartSpec,
} from "./types";

export function createBlankSet(input: {
  id: string;
  name: string;
  coverDataUrl: string | null;
  now: number;
}): BrickSet {
  return {
    id: input.id,
    name: input.name.trim(),
    coverDataUrl: input.coverDataUrl,
    createdAt: input.now,
    updatedAt: input.now,
    pages: [],
    steps: [],
    progress: emptyProgress(),
    sample: false,
  };
}

export function orderedSteps(pages: Pick<InstructionPage, "id" | "order">[], steps: BuildStep[]): BuildStep[] {
  const rank = new Map(pages.map((page) => [page.id, page.order]));
  return [...steps].sort((a, b) => {
    const pageDelta = (rank.get(a.pageId) ?? 0) - (rank.get(b.pageId) ?? 0);
    if (pageDelta !== 0) return pageDelta;
    return a.stepNumber - b.stepNumber;
  });
}

export function toBuildSteps(pageId: string, parsed: ParsedExtraction, id: () => string): BuildStep[] {
  return parsed.steps.map((step) => ({
    ...step,
    id: id(),
    pageId,
    parts: step.parts.map((part) => ({ ...part, id: id() })),
  }));
}

export function applyPageExtraction(
  set: BrickSet,
  pageId: string,
  parsed: ParsedExtraction,
  id: () => string,
): BrickSet {
  const pages = set.pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          status: parsed.retake.needed ? ("retake" as const) : ("ready" as const),
          error: undefined,
          retake: parsed.retake.needed ? parsed.retake : { needed: false, reasons: [] },
        }
      : page,
  );
  const steps = [
    ...set.steps.filter((step) => step.pageId !== pageId),
    ...toBuildSteps(pageId, parsed, id),
  ];
  const ordered = orderedSteps(pages, steps);
  return {
    ...set,
    pages,
    steps,
    progress: reconcileProgress(set.progress, ordered),
  };
}

export function maxStepNumberBefore(set: BrickSet, pageId: string): number {
  const pages = [...set.pages].sort((a, b) => a.order - b.order);
  const index = pages.findIndex((page) => page.id === pageId);
  const earlier = new Set(pages.slice(0, Math.max(index, 0)).map((page) => page.id));
  return set.steps
    .filter((step) => earlier.has(step.pageId))
    .reduce((max, step) => Math.max(max, step.stepNumber), 0);
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function reorderPages(set: BrickSet, from: number, to: number): BrickSet {
  const sorted = [...set.pages].sort((a, b) => a.order - b.order);
  const pages = moveItem(sorted, from, to).map((page, order) => ({ ...page, order }));
  return { ...set, pages };
}

export function appendPages(
  set: BrickSet,
  images: { imageDataUrl: string; fileName: string }[],
  id: () => string,
): BrickSet {
  const start = set.pages.length;
  const pages = images.map((image, index) => ({
    id: id(),
    order: start + index,
    imageDataUrl: image.imageDataUrl,
    fileName: image.fileName,
    status: "pending" as const,
    retake: null,
  }));
  return { ...set, pages: [...set.pages, ...pages] };
}

export function replacePageImage(
  set: BrickSet,
  pageId: string,
  imageDataUrl: string,
  fileName: string,
): BrickSet {
  const removed = new Set(set.steps.filter((step) => step.pageId === pageId).map((step) => step.id));
  const steps = set.steps.filter((step) => step.pageId !== pageId);
  const checkedByStep = { ...set.progress.checkedByStep };
  for (const stepId of removed) delete checkedByStep[stepId];
  return {
    ...set,
    pages: set.pages.map((page) =>
      page.id === pageId
        ? { ...page, imageDataUrl, fileName, status: "pending", error: undefined, retake: null }
        : page,
    ),
    steps,
    progress: reconcileProgress(
      {
        ...set.progress,
        checkedByStep,
        currentStepId: set.progress.currentStepId && removed.has(set.progress.currentStepId)
          ? null
          : set.progress.currentStepId,
      },
      orderedSteps(set.pages, steps),
    ),
  };
}

export function markPageReading(set: BrickSet, pageId: string): BrickSet {
  return {
    ...set,
    pages: set.pages.map((page) =>
      page.id === pageId ? { ...page, status: "reading", error: undefined } : page,
    ),
  };
}

export function markPageError(set: BrickSet, pageId: string, message: string): BrickSet {
  return {
    ...set,
    pages: set.pages.map((page) =>
      page.id === pageId ? { ...page, status: "error", error: message } : page,
    ),
  };
}

export function mergeSteps(set: BrickSet, index: number): BrickSet {
  const steps = orderedSteps(set.pages, set.steps);
  if (index < 0 || index >= steps.length - 1) return set;
  const first = steps[index];
  const second = steps[index + 1];
  const placementUncertain =
    first.placementCertainty === "uncertain" || second.placementCertainty === "uncertain";
  const placementNote = [first.placementNote, second.placementNote].filter(Boolean).join(" ") || null;
  const merged: BuildStep = {
    ...first,
    description: `${first.description} ${second.description}`.trim(),
    parts: [...first.parts, ...second.parts],
    region: first.pageId === second.pageId ? unionRegion(first.region, second.region) : first.region,
    stepNumber: Math.min(first.stepNumber, second.stepNumber),
    placementCertainty: placementUncertain ? "uncertain" : "certain",
    placementNote: placementUncertain ? placementNote : null,
  };
  const nextSteps = [...steps.slice(0, index), merged, ...steps.slice(index + 2)];
  const checks = new Set([
    ...(set.progress.checkedByStep[first.id] ?? []),
    ...(set.progress.checkedByStep[second.id] ?? []),
  ]);
  const checkedByStep = { ...set.progress.checkedByStep };
  delete checkedByStep[second.id];
  const kept = [...checks].filter((partId) => merged.parts.some((part) => part.id === partId));
  if (kept.length > 0) checkedByStep[first.id] = kept;
  else delete checkedByStep[first.id];
  return {
    ...set,
    steps: nextSteps,
    progress: reconcileProgress({ ...set.progress, checkedByStep, currentStepId: merged.id }, nextSteps),
  };
}

export function splitStep(set: BrickSet, index: number, newId: string): BrickSet {
  const steps = orderedSteps(set.pages, set.steps);
  const step = steps[index];
  if (!step) return set;
  const midpoint = Math.ceil(step.parts.length / 2);
  const canDivide = step.parts.length >= 2;
  const firstParts = canDivide ? step.parts.slice(0, midpoint) : step.parts;
  const secondParts = canDivide ? step.parts.slice(midpoint) : [];
  const first: BuildStep = { ...step, parts: firstParts, region: splitRegion(step.region, "top") };
  const second: BuildStep = {
    ...step,
    id: newId,
    parts: secondParts,
    region: splitRegion(step.region, "bottom"),
    description: `Continued. ${step.description}`,
    placementCertainty: step.placementCertainty,
    placementNote: step.placementNote,
  };
  const nextSteps = [...steps.slice(0, index), first, second, ...steps.slice(index + 1)];
  const secondIds = new Set(secondParts.map((part) => part.id));
  const checked = set.progress.checkedByStep[step.id] ?? [];
  const checkedByStep = { ...set.progress.checkedByStep };
  const stay = checked.filter((partId) => !secondIds.has(partId));
  const moved = checked.filter((partId) => secondIds.has(partId));
  if (stay.length > 0) checkedByStep[step.id] = stay;
  else delete checkedByStep[step.id];
  if (moved.length > 0) checkedByStep[newId] = moved;
  return { ...set, steps: nextSteps, progress: { ...set.progress, checkedByStep } };
}

export function updateStep(
  set: BrickSet,
  stepId: string,
  patch: Partial<Pick<BuildStep, "description" | "stepNumber">>,
): BrickSet {
  return {
    ...set,
    steps: set.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
  };
}

export function setPlacement(set: BrickSet, stepId: string, certainty: Certainty, note: string | null): BrickSet {
  return {
    ...set,
    steps: set.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            placementCertainty: certainty,
            placementNote: certainty === "uncertain" ? note : null,
          }
        : step,
    ),
  };
}

export function updatePartPlacement(
  set: BrickSet,
  stepId: string,
  partId: string,
  placement: PartPlacement,
): BrickSet {
  return mapPart(set, stepId, partId, (part) => ({ ...part, placement }));
}

export function updatePart(set: BrickSet, stepId: string, partId: string, patch: Partial<PartSpec>): BrickSet {
  return mapPart(set, stepId, partId, (part) => ({ ...part, ...patch }));
}

export function markPartClear(set: BrickSet, stepId: string, partId: string): BrickSet {
  return mapPart(set, stepId, partId, (part) => {
    if (!canMarkPartCertain(part)) return part;
    return { ...part, certainty: "certain", uncertainFields: [], uncertaintyNote: null };
  });
}

export function markPartUnsure(set: BrickSet, stepId: string, partId: string, note: string): BrickSet {
  return mapPart(set, stepId, partId, (part) => ({
    ...part,
    certainty: "uncertain",
    uncertaintyNote: note.trim() || part.uncertaintyNote || "Marked unsure while checking the booklet.",
  }));
}

export function addPart(set: BrickSet, stepId: string, partId: string): BrickSet {
  const part: Part = {
    id: partId,
    color: "Unclear",
    shape: "Unclear",
    size: "Unclear",
    quantity: null,
    certainty: "uncertain",
    uncertainFields: ["color", "shape", "size", "quantity"],
    uncertaintyNote: "Fill in this piece. Nothing was guessed.",
    placement: unknownPlacement("This piece has no stud position yet."),
  };
  return {
    ...set,
    steps: set.steps.map((step) => (step.id === stepId ? { ...step, parts: [...step.parts, part] } : step)),
  };
}

export function removePart(set: BrickSet, stepId: string, partId: string): BrickSet {
  const steps = set.steps.map((step) =>
    step.id === stepId ? { ...step, parts: step.parts.filter((part) => part.id !== partId) } : step,
  );
  const checked = (set.progress.checkedByStep[stepId] ?? []).filter((id) => id !== partId);
  const checkedByStep = { ...set.progress.checkedByStep };
  if (checked.length > 0) checkedByStep[stepId] = checked;
  else delete checkedByStep[stepId];
  return { ...set, steps, progress: { ...set.progress, checkedByStep } };
}

export function deleteStep(set: BrickSet, stepId: string): BrickSet {
  const steps = set.steps.filter((step) => step.id !== stepId);
  const checkedByStep = { ...set.progress.checkedByStep };
  delete checkedByStep[stepId];
  const ordered = orderedSteps(set.pages, steps);
  return {
    ...set,
    steps,
    progress: reconcileProgress(
      {
        ...set.progress,
        checkedByStep,
        currentStepId: set.progress.currentStepId === stepId ? null : set.progress.currentStepId,
      },
      ordered,
    ),
  };
}

export function addBlankStep(set: BrickSet, pageId: string, stepId: string): BrickSet {
  const onPage = set.steps.filter((step) => step.pageId === pageId);
  const stepNumber = onPage.reduce((max, step) => Math.max(max, step.stepNumber), 0) + 1;
  const step: BuildStep = {
    id: stepId,
    pageId,
    stepNumber: Math.max(1, stepNumber),
    description: "Describe where the new pieces go.",
    parts: [],
    region: null,
    placementCertainty: "certain",
    placementNote: null,
  };
  return { ...set, steps: [...set.steps, step] };
}

function mapPart(set: BrickSet, stepId: string, partId: string, map: (part: Part) => Part): BrickSet {
  return {
    ...set,
    steps: set.steps.map((step) =>
      step.id === stepId ? { ...step, parts: step.parts.map((part) => (part.id === partId ? map(part) : part)) } : step,
    ),
  };
}
