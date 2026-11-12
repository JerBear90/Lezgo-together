import { describe, expect, it } from "vitest";
import { buildDemoSet } from "./demo";
import {
  EXTRACTION_INSTRUCTIONS,
  ExtractionError,
  extractionSchema,
  mockPageExtraction,
  parseExtraction,
} from "./extraction";
import { attentionCounts, canMarkPartCertain, retakeMessage, uncertaintyLabel } from "./labels";
import { canDrawArrow, formatStudPlacement } from "./placement";

const certainPlacement = {
  point: { x: 0.4, y: 0.5 },
  callout: { x: 0.8, y: 0.2 },
  studs: { along: 3, fromEdge: "left edge", row: 2, onto: "blue 2x6", relation: "on top of" },
  poses: [{ x: 3, y: 1, layer: 3, rotation: 0 }],
  certainty: "certain" as const,
  uncertainFields: [] as const,
  note: null,
  needsRetake: false,
  corrected: false,
};

const certainPart = {
  color: "Red",
  shape: "brick",
  size: "2x4",
  quantity: 2,
  certainty: "certain",
  uncertainFields: [],
  uncertaintyNote: null,
  placement: certainPlacement,
};

describe("extraction schema", () => {
  it("accepts a page with an uncertain part and a retake flag", () => {
    const result = extractionSchema.safeParse({
      pageSummary: "Hull",
      retake: { needed: true, reasons: ["too blurry", "step 4 cut off"] },
      steps: [
        {
          stepNumber: 4,
          description: "Only a corner of the step is in frame.",
          placementCertainty: "uncertain",
          placementNote: "The step is cut off.",
          region: null,
          parts: [
            {
              color: "Unclear",
              shape: "brick",
              size: "2x4",
              quantity: null,
              certainty: "uncertain",
              uncertainFields: ["color", "quantity"],
              uncertaintyNote: "Color and count are not readable.",
              placement: {
                point: null,
                callout: null,
                studs: { along: null, fromEdge: null, row: null, onto: null, relation: null },
                poses: [{ x: null, y: null, layer: null, rotation: null }],
                certainty: "uncertain",
                uncertainFields: ["point", "studs"],
                note: "can't count studs, photo angle",
                needsRetake: true,
                corrected: false,
              },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a quantity that is still a string", () => {
    const result = extractionSchema.safeParse({
      pageSummary: "",
      retake: { needed: false, reasons: [] },
      steps: [
        {
          stepNumber: 1,
          description: "Place the brick.",
          placementCertainty: "certain",
          placementNote: null,
          region: null,
          parts: [{ ...certainPart, quantity: "2" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload that omits the retake flag", () => {
    const result = extractionSchema.safeParse({
      pageSummary: "Cover",
      steps: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("parseExtraction", () => {
  it("keeps an explicit uncertain part and does not invent a color or count", () => {
    const parsed = parseExtraction({
      pageSummary: "dark page",
      retake: { needed: true, reasons: ["too blurry", "step 4 cut off"] },
      steps: [
        {
          stepNumber: 4,
          description: "Only the corner of this step is in frame.",
          placementCertainty: "uncertain",
          placementNote: "The step is cut off, so the placement is not readable.",
          region: null,
          parts: [
            {
              color: "unknown",
              shape: "brick",
              size: "2 x 4",
              quantity: "?",
              certainty: "uncertain",
              uncertainFields: ["color", "quantity"],
              uncertaintyNote: "Color and count are not readable.",
            },
          ],
        },
      ],
    });

    expect(parsed.retake).toEqual({ needed: true, reasons: ["too blurry", "step 4 cut off"] });
    expect(parsed.steps[0]?.placementCertainty).toBe("uncertain");
    const part = parsed.steps[0]?.parts[0];
    expect(part?.color).toBe("Unclear");
    expect(part?.color).not.toMatch(/red|blue|yellow|black/i);
    expect(part?.quantity).toBeNull();
    expect(part?.quantity).not.toBe(1);
    expect(part?.certainty).toBe("uncertain");
    expect(part?.uncertainFields).toEqual(["color", "quantity"]);
    expect(part?.size).toBe("2x4");
    expect(uncertaintyLabel(part!)).toMatch(/Unsure: color and quantity/);
  });

  it("treats a blurry photoQuality as a retake even if the model also said the page was fine", () => {
    const parsed = parseExtraction({
      pageSummary: "",
      retake: { needed: false, reasons: [] },
      photoQuality: "too blurry and step 4 is cut off",
      steps: [
        {
          stepNumber: 1,
          description: "A brick is visible in the corner.",
          placementCertainty: "certain",
          placementNote: null,
          region: null,
          parts: [certainPart],
        },
      ],
    });
    expect(parsed.retake.needed).toBe(true);
    expect(parsed.retake.reasons.join(" ")).toMatch(/blurry/i);
    expect(retakeMessage(parsed.retake)).toMatch(/Too blurry/);
  });

  it("does not ask for a retake when the photo is clear", () => {
    const parsed = parseExtraction({
      pageSummary: "Clear page",
      photoQuality: "good",
      steps: [
        {
          step: "1",
          text: "Press the red 2x4 onto the studs.",
          pieces: [{ colour: "red", type: "brick", size: "2×4", qty: "2", certainty: "certain" }],
        },
      ],
    });
    expect(parsed.retake.needed).toBe(false);
    expect(parsed.retake.reasons).toEqual([]);
    expect(parsed.steps[0]?.parts[0]).toMatchObject({
      color: "Red",
      shape: "brick",
      size: "2x4",
      quantity: 2,
      certainty: "certain",
    });
  });

  it("prefers uncertain when a note admits a guess", () => {
    const parsed = parseExtraction({
      retake: { needed: false, reasons: [] },
      steps: [
        {
          stepNumber: 2,
          description: "Maybe this plate goes on the left.",
          placementCertainty: "certain",
          placementNote: "Might be the left side, hard to tell.",
          region: [0, 0, 50, 40],
          parts: [
            {
              color: "Dark blue",
              shape: "plate",
              size: "1x2",
              quantity: 1,
              certainty: "certain",
              confidence: 0.2,
              uncertaintyNote: "The color might be black.",
            },
          ],
        },
      ],
    });
    expect(parsed.steps[0]?.placementCertainty).toBe("uncertain");
    expect(parsed.steps[0]?.parts[0]?.certainty).toBe("uncertain");
    expect(parsed.steps[0]?.parts[0]?.color).toBe("Dark Blue");
    expect(parsed.steps[0]?.region).toEqual({ x: 0, y: 0, width: 0.5, height: 0.4 });
  });

  it("continues step numbers instead of restarting each page", () => {
    const parsed = parseExtraction(mockPageExtraction(1), { previousMaxStep: 3 });
    expect(parsed.steps.map((step) => step.stepNumber)).toEqual([4, 5]);
    const again = parseExtraction(
      {
        pageSummary: "",
        retake: { needed: false, reasons: [] },
        steps: [
          { ...parsed.steps[0] },
          { ...parsed.steps[1] },
        ],
      },
      { previousMaxStep: 3 },
    );
    expect(again.steps.map((step) => step.stepNumber)).toEqual([4, 5]);
  });

  it("rejects a clear page with no steps", () => {
    expect(() => parseExtraction({ retake: { needed: false, reasons: [] }, steps: [] })).toThrow(ExtractionError);
  });

  it("allows an empty step list when a retake is required", () => {
    const parsed = parseExtraction({
      retake: { needed: true, reasons: ["too dark"] },
      steps: [],
    });
    expect(parsed.steps).toEqual([]);
    expect(parsed.retake.needed).toBe(true);
  });

  it("tells the model to prefer uncertain over guessing", () => {
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/Prefer uncertain over guessing/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/Do not guess/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/too blurry/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/retake\.needed/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/Count studs/);
    expect(EXTRACTION_INSTRUCTIONS).toMatch(/Do not estimate/);
  });

  it("drops a stud count the model was not sure of and does not draw an arrow", () => {
    const parsed = parseExtraction({
      retake: { needed: false, reasons: [] },
      steps: [
        {
          stepNumber: 1,
          description: "A red brick goes somewhere on the hull.",
          placementCertainty: "certain",
          placementNote: null,
          region: { x: 0.1, y: 0.1, width: 0.8, height: 0.4 },
          parts: [
            {
              ...certainPart,
              placement: {
                point: { x: 0.5, y: 0.5 },
                callout: { x: 0.2, y: 0.2 },
                studs: { along: 3, fromEdge: "left edge", row: 2, onto: "blue 2x6", relation: "on top of" },
                poses: [{ x: 3, y: 1, layer: 3, rotation: 0 }],
                certainty: "uncertain",
                uncertainFields: ["studs"],
                note: "can't count studs, photo angle",
                needsRetake: true,
                corrected: false,
              },
            },
          ],
        },
      ],
    });
    const part = parsed.steps[0]?.parts[0];
    expect(part?.placement.studs.along).toBeNull();
    expect(part?.placement.studs.row).toBeNull();
    expect(part?.placement.needsRetake).toBe(true);
    expect(part?.placement.certainty).toBe("uncertain");
    expect(canDrawArrow(part!)).toBe(false);
    expect(formatStudPlacement(part!)).toBeNull();
  });

  it("keeps a counted stud offset when the reading is certain", () => {
    const parsed = parseExtraction({
      retake: { needed: false, reasons: [] },
      steps: [
        {
          stepNumber: 1,
          description: "The red brick sits on the blue plate.",
          parts: [certainPart],
        },
      ],
    });
    const part = parsed.steps[0]?.parts[0];
    expect(part?.placement.poses[0]).toMatchObject({ x: 3, y: 1, layer: 3, rotation: 0 });
    expect(formatStudPlacement(part!)).toBe(
      "Red 2x4: place 3 studs in from the left edge, 2nd row from the front, on top of the blue 2x6.",
    );
    expect(canDrawArrow(part!)).toBe(true);
  });
});

describe("sample set flags", () => {
  it("includes an unsure part and a page that needs a retake", () => {
    const set = buildDemoSet(0);
    const attention = attentionCounts(set);
    expect(attention.retakes).toBe(1);
    expect(attention.unsureParts).toBe(1);
    expect(attention.unsureSteps).toBe(1);
    const page = set.pages.find((item) => item.retake?.needed);
    expect(page?.retake?.reasons).toEqual(["too blurry", "step 9 cut off"]);
    expect(retakeMessage(page?.retake)).toBe("Too blurry. Step 9 cut off.");
    const part = set.steps.flatMap((step) => step.parts).find((item) => item.certainty === "uncertain");
    expect(part?.color).toBe("Unclear");
    expect(canMarkPartCertain(part!)).toBe(false);
  });
});
