import { describe, expect, it } from "vitest";
import { buildScene } from "./build-model";
import { lookupColor, lookupPart } from "./catalog";
import { buildDemoSet } from "./demo";
import { orderedSteps } from "./editing";
import { layoutScene } from "./iso";
import { unknownPlacement } from "./placement";
import type { BuildStep, Part } from "./types";

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
    placement: {
      point: { x: 0.4, y: 0.5 },
      callout: { x: 0.7, y: 0.2 },
      studs: { along: 0, fromEdge: "left edge", row: 1, onto: null, relation: null },
      poses: [{ x: 0, y: 0, layer: 0, rotation: 0 }],
      certainty: "certain",
      uncertainFields: [],
      note: null,
      needsRetake: false,
      corrected: false,
    },
    ...overrides,
  };
}

function step(id: string, stepNumber: number, parts: Part[]): BuildStep {
  return {
    id,
    pageId: "p",
    stepNumber,
    description: "Place the pieces.",
    parts,
    region: null,
    placementCertainty: "certain",
    placementNote: null,
  };
}

describe("part catalog", () => {
  it("maps a 2x4 brick and red to standard ids, and refuses an unknown shape", () => {
    expect(lookupPart("brick", "2x4")).toEqual({ id: "3001", name: "Brick 2 x 4" });
    expect(lookupPart("Brick", "2×4")?.id).toBe("3001");
    expect(lookupColor("Red")).toBe(4);
    expect(lookupPart("widget", "2x4")).toBeNull();
    expect(lookupColor("Unclear")).toBeNull();
  });
});

describe("build state", () => {
  const steps = [
    step("s1", 1, [part("a", { quantity: 2, placement: { ...part("a").placement, poses: [
      { x: 0, y: 0, layer: 0, rotation: 0 },
      { x: 2, y: 0, layer: 0, rotation: 0 },
    ] } })]),
    step("s2", 2, [part("b", {
      color: "Black",
      shape: "plate",
      size: "2x4",
      quantity: 1,
      placement: {
        ...part("b").placement,
        studs: { along: 0, fromEdge: "left edge", row: 1, onto: "red 2x4", relation: "on top of" },
        poses: [{ x: 0, y: 0, layer: 3, rotation: 0 }],
      },
    })]),
    step("s3", 3, [part("c", {
      color: "Unclear",
      shape: "tile",
      size: "1x2",
      quantity: 2,
      certainty: "uncertain",
      uncertainFields: ["color"],
      uncertaintyNote: "Pale ink.",
      placement: {
        ...unknownPlacement("can't count studs, photo angle"),
        needsRetake: true,
        poses: [{ x: 9, y: 9, layer: 1, rotation: 0 }],
      },
    })]),
  ];

  it("stacks later steps on earlier ones and does not place the future", () => {
    const first = buildScene(steps, "s1");
    expect(first.bricks).toHaveLength(2);
    expect(first.bricks.every((brick) => brick.ldrawId === "3001" && brick.ldrawColor === 4 && brick.confident)).toBe(true);
    expect(first.bricks.map((brick) => brick.x)).toEqual([0, 2]);

    const second = buildScene(steps, "s2");
    expect(second.bricks.filter((brick) => !brick.isNew)).toHaveLength(2);
    const plate = second.bricks.find((brick) => brick.isNew);
    expect(plate).toMatchObject({ ldrawId: "3020", ldrawColor: 0, x: 0, y: 0, layer: 3, confident: true });
    expect(second.bricks.some((brick) => brick.partId === "c")).toBe(false);
  });

  it("keeps an uncertain part as a ghost and drops the model's coordinates", () => {
    const scene = buildScene(steps, "s3");
    const ghost = scene.bricks.find((brick) => brick.partId === "c");
    expect(ghost).toMatchObject({ confident: false, x: null, y: null, layer: null, ldrawId: null, needsRetake: true });
    expect(scene.bricks.filter((brick) => brick.partId === "c")).toHaveLength(1);
    const layout = layoutScene(scene);
    expect(layout.markers.find((marker) => marker.partId === "c")?.ghost).toBe(true);
    expect(layout.markers.filter((marker) => marker.partId === "c" && !marker.ghost)).toHaveLength(0);
  });

  it("builds the sample tug through every confident stud and one ghost", () => {
    const set = buildDemoSet(0);
    const ordered = orderedSteps(set.pages, set.steps);
    const scene = buildScene(ordered, "demo-step-8");
    const confident = scene.bricks.filter((brick) => brick.confident);
    const ghosts = scene.bricks.filter((brick) => !brick.confident);
    expect(confident).toHaveLength(17);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]).toMatchObject({ x: null, isNew: false, needsRetake: true });
    const windows = buildScene(ordered, "demo-step-5");
    expect(windows.bricks.find((brick) => !brick.confident)).toMatchObject({ isNew: true, x: null });
    expect(confident.every((brick) => brick.x != null && brick.layer != null && brick.ldrawId)).toBe(true);

    const opening = buildScene(ordered, "demo-step-1");
    expect(opening.bricks.map((brick) => [brick.x, brick.y, brick.layer])).toEqual([
      [3, 1, 0],
      [5, 1, 0],
    ]);
    const laid = layoutScene(opening);
    expect(laid.markers.filter((marker) => !marker.ghost)).toHaveLength(2);
    expect(laid.faces.length).toBeGreaterThan(0);
  });
});
