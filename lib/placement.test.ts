import { describe, expect, it } from "vitest";
import { canDrawArrow, formatStudPlacement, nudgeStud, shiftPose, unknownPlacement } from "./placement";
import type { PartPlacement, PartSpec } from "./types";

const placement: PartPlacement = {
  point: { x: 0.4, y: 0.6 },
  callout: { x: 0.8, y: 0.2 },
  studs: { along: 3, fromEdge: "left edge", row: 2, onto: "blue 2x6", relation: "on top of" },
  poses: [{ x: 3, y: 1, layer: 3, rotation: 0 }],
  certainty: "certain",
  uncertainFields: [],
  note: null,
  needsRetake: false,
  corrected: false,
};

const part: PartSpec = {
  color: "Red",
  shape: "brick",
  size: "2x4",
  quantity: 1,
  certainty: "certain",
  uncertainFields: [],
  uncertaintyNote: null,
  placement,
};

describe("stud placement text", () => {
  it("formats a stud offset from a named edge and the piece underneath", () => {
    expect(formatStudPlacement(part)).toBe(
      "Red 2x4: place 3 studs in from the left edge, 2nd row from the front, on top of the blue 2x6.",
    );
  });

  it("does not invent a stud count when the count was not made", () => {
    const unclear = {
      ...part,
      placement: {
        ...placement,
        studs: { ...placement.studs, along: null, row: null },
        certainty: "uncertain" as const,
        uncertainFields: ["studs" as const],
        note: "can't count studs, photo angle",
        needsRetake: true,
      },
    };
    expect(formatStudPlacement(unclear)).toBeNull();
    expect(canDrawArrow(unclear)).toBe(false);
  });

  it("says flush when the piece starts on the reference edge", () => {
    const flush = {
      ...part,
      placement: { ...placement, studs: { ...placement.studs, along: 0, row: 1, onto: null, relation: null } },
    };
    expect(formatStudPlacement(flush)).toBe("Red 2x4: flush with the left edge, 1st row from the front.");
  });
});

describe("placement corrections", () => {
  it("moves a pose by one stud and remembers that a person did it", () => {
    const moved = shiftPose(placement, 0, "x", 1);
    expect(moved.poses[0]?.x).toBe(4);
    expect(moved.studs.along).toBe(4);
    expect(moved.corrected).toBe(true);
    expect(moved.point?.x).toBeCloseTo(0.44);
  });

  it("nudges the row without dropping below the first row", () => {
    const nudged = nudgeStud(placement, "row", -5);
    expect(nudged.studs.row).toBe(1);
    expect(nudged.corrected).toBe(true);
  });

  it("treats a missing placement as unsure and draws no arrow", () => {
    const missing = { ...part, placement: unknownPlacement() };
    expect(canDrawArrow(missing)).toBe(false);
    expect(formatStudPlacement(missing)).toBeNull();
  });
});
