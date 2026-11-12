import { describe, expect, it } from "vitest";
import { applyPageExtraction, mergeSteps, moveItem, reorderPages, splitStep } from "./editing";
import { parseExtraction } from "./extraction";
import { rollupParts } from "./parts";
import {
  applySwipe,
  emptyProgress,
  goBack,
  goNext,
  jumpTo,
  progressFraction,
  reconcileProgress,
  stepIndex,
  swipeDirection,
  togglePart,
} from "./player";
import type { BrickSet, BuildStep, Part } from "./types";

function part(id: string, overrides: Partial<Part> = {}): Part {
  return {
    id,
    color: "Red",
    shape: "brick",
    size: "2x4",
    quantity: 1,
    certainty: "certain",
    uncertainFields: [],
    uncertaintyNote: null,
    ...overrides,
  };
}

function step(id: string, pageId: string, stepNumber: number, parts: Part[], extras: Partial<BuildStep> = {}): BuildStep {
  return {
    id,
    pageId,
    stepNumber,
    description: `Do step ${stepNumber}.`,
    parts,
    region: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
    placementCertainty: "certain",
    placementNote: null,
    ...extras,
  };
}

function setWith(steps: BuildStep[]): BrickSet {
  return {
    id: "set",
    name: "Test",
    coverDataUrl: null,
    createdAt: 0,
    updatedAt: 0,
    pages: [
      { id: "p1", order: 0, imageDataUrl: "data:", fileName: "a.jpg", status: "ready", retake: null },
      { id: "p2", order: 1, imageDataUrl: "data:", fileName: "b.jpg", status: "ready", retake: null },
    ],
    steps,
    progress: emptyProgress(),
    sample: false,
  };
}

describe("step player", () => {
  const steps = [
    step("s1", "p1", 1, [part("a")]),
    step("s2", "p1", 2, [part("b")]),
    step("s3", "p2", 3, [part("c")]),
  ];

  it("moves next and back without leaving the list", () => {
    let progress = emptyProgress();
    expect(stepIndex(steps, progress.currentStepId)).toBe(0);
    progress = goNext(steps, progress);
    expect(progress.currentStepId).toBe("s2");
    progress = goNext(steps, progress);
    progress = goNext(steps, progress);
    expect(progress.currentStepId).toBe("s3");
    progress = goBack(steps, progress);
    expect(progress.currentStepId).toBe("s2");
    progress = jumpTo(steps, progress, 0);
    expect(progress.currentStepId).toBe("s1");
    expect(progressFraction(steps, "s2")).toBeCloseTo(2 / 3);
  });

  it("treats a left swipe as next and ignores a vertical drag", () => {
    expect(swipeDirection(-80, 10)).toBe("next");
    expect(swipeDirection(80, 5)).toBe("back");
    expect(swipeDirection(-10, 0)).toBeNull();
    expect(swipeDirection(-40, 80)).toBeNull();
    const progress = applySwipe(steps, emptyProgress(), -90, 4);
    expect(progress.currentStepId).toBe("s2");
    expect(applySwipe(steps, progress, 0, 100).currentStepId).toBe("s2");
  });

  it("checks a part off and on, then drops stale checks", () => {
    let progress = togglePart(emptyProgress(), "s1", "a");
    expect(progress.checkedByStep.s1).toEqual(["a"]);
    progress = togglePart(progress, "s1", "a");
    expect(progress.checkedByStep.s1).toEqual([]);
    progress = togglePart(togglePart(emptyProgress(), "s1", "a"), "s1", "gone");
    const reconciled = reconcileProgress(progress, [steps[0]]);
    expect(reconciled.checkedByStep.s1).toEqual(["a"]);
    expect(reconciled.currentStepId).toBeNull();
  });

  it("falls back when the saved step was removed", () => {
    const reconciled = reconcileProgress({ currentStepId: "missing", checkedByStep: {} }, steps);
    expect(reconciled.currentStepId).toBe("s1");
  });
});

describe("editing and parts rollup", () => {
  it("merges steps without turning an unsure part into a certain one", () => {
    const unsure = part("u", {
      color: "Unclear",
      certainty: "uncertain",
      uncertainFields: ["color"],
      uncertaintyNote: "Pale ink.",
      quantity: null,
    });
    const set = setWith([
      step("s1", "p1", 1, [part("a")], { region: { x: 0, y: 0, width: 0.5, height: 0.2 } }),
      step("s2", "p1", 2, [unsure], {
        placementCertainty: "uncertain",
        placementNote: "Side is unclear.",
        region: { x: 0.4, y: 0.1, width: 0.5, height: 0.2 },
      }),
    ]);
    const merged = mergeSteps(
      { ...set, progress: { currentStepId: "s1", checkedByStep: { s1: ["a"], s2: ["u"] } } },
      0,
    );
    expect(merged.steps).toHaveLength(1);
    expect(merged.steps[0]?.placementCertainty).toBe("uncertain");
    expect(merged.steps[0]?.parts.map((item) => item.certainty)).toEqual(["certain", "uncertain"]);
    expect(merged.steps[0]?.parts[1]?.color).toBe("Unclear");
    expect(merged.steps[0]?.region).toMatchObject({ x: 0, width: 0.9 });
    expect(merged.progress.checkedByStep.s1).toEqual(expect.arrayContaining(["a", "u"]));
  });

  it("splits a step and keeps each part's certainty", () => {
    const set = setWith([
      step("s1", "p1", 4, [part("a"), part("b", { certainty: "uncertain", uncertainFields: ["size"] })]),
    ]);
    const split = splitStep(set, 0, "s1b");
    expect(split.steps.map((item) => item.id)).toEqual(["s1", "s1b"]);
    expect(split.steps[1]?.parts[0]?.certainty).toBe("uncertain");
    expect(split.steps[0]?.region?.height).toBeCloseTo(0.1);
  });

  it("reorders pages and rolls uncertain quantities up as unknown", () => {
    const moved = moveItem(["a", "b", "c"], 0, 2);
    expect(moved).toEqual(["b", "c", "a"]);
    const set = reorderPages(setWith([]), 0, 1);
    expect(set.pages.map((page) => page.id)).toEqual(["p2", "p1"]);
    expect(set.pages.map((page) => page.order)).toEqual([0, 1]);

    const rolled = rollupParts([
      step("s1", "p1", 1, [part("a", { quantity: 2 })]),
      step("s2", "p1", 2, [part("b", { quantity: 2 })]),
      step("s3", "p2", 3, [
        part("c", {
          color: "Unclear",
          shape: "tile",
          size: "1x2",
          quantity: null,
          certainty: "uncertain",
          uncertainFields: ["color", "quantity"],
          uncertaintyNote: "Count is hidden.",
        }),
      ]),
    ]);
    const red = rolled.find((item) => item.color === "Red");
    const unclear = rolled.find((item) => item.color === "Unclear");
    expect(red).toMatchObject({ quantity: 4, certainty: "certain" });
    expect(unclear).toMatchObject({ quantity: null, certainty: "uncertain" });
    expect(unclear?.stepNumbers).toEqual([3]);
  });

  it("stores a retake flag from a parsed page and replaces that page's steps", () => {
    const set = setWith([step("old", "p1", 1, [part("a")])]);
    const parsed = parseExtraction({
      pageSummary: "Blur",
      retake: { needed: true, reasons: ["too blurry"] },
      steps: [
        {
          stepNumber: 1,
          description: "This step could not be read.",
          placementCertainty: "uncertain",
          placementNote: "Cut off.",
          region: null,
          parts: [
            {
              color: "Unclear",
              shape: "Unclear",
              size: "Unclear",
              quantity: null,
              certainty: "uncertain",
              uncertainFields: ["color", "shape", "size", "quantity"],
              uncertaintyNote: "Nothing on this piece is readable.",
            },
          ],
        },
      ],
    });
    let n = 0;
    const next = applyPageExtraction(set, "p1", parsed, () => `id-${n++}`);
    expect(next.pages.find((page) => page.id === "p1")?.status).toBe("retake");
    expect(next.pages.find((page) => page.id === "p1")?.retake?.needed).toBe(true);
    expect(next.steps.map((item) => item.id)).toEqual(["id-0"]);
    expect(next.steps[0]?.parts[0]?.certainty).toBe("uncertain");
    expect(next.steps.some((item) => item.id === "old")).toBe(false);
  });
});
