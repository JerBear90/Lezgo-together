import { z } from "zod";
import { unknownPlacement } from "./placement";
import { clampRegion } from "./region";
import {
  PLACEMENT_FIELDS,
  UNCERTAIN_FIELDS,
  type Certainty,
  type NormPoint,
  type ParsedExtraction,
  type PartPlacement,
  type PartSpec,
  type PlacementUncertainField,
  type RetakeFlag,
  type StepSpec,
  type StudOffset,
  type StudPose,
  type UncertainField,
} from "./types";

export const regionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const partSchema = z.object({
  color: z
    .string()
    .describe('Common color name. Use "Unclear" when the color cannot be read. Do not guess.'),
  shape: z
    .string()
    .describe('Piece type such as brick, plate, tile, or slope. Use "Unclear" when it cannot be read.'),
  size: z.string().describe('Stud size such as 2x4. Use "Unclear" when it cannot be read.'),
  quantity: z
    .number()
    .nullable()
    .describe("New pieces added in this step. Null when the count cannot be read. Do not guess 1."),
  certainty: z
    .enum(["certain", "uncertain"])
    .describe("uncertain if color, shape, size, or quantity is not clearly readable."),
  uncertainFields: z
    .array(z.enum(UNCERTAIN_FIELDS))
    .describe("Which of color, shape, size, or quantity could not be read. Empty when certain."),
  uncertaintyNote: z
    .string()
    .nullable()
    .describe("What is unclear about this part, or null when the part is certain."),
  placement: z.object({
    point: z
      .object({ x: z.number(), y: z.number() })
      .nullable()
      .describe("Where this new part sits inside this step's diagram, fractions from 0 to 1. Null if you cannot see the spot."),
    callout: z
      .object({ x: z.number(), y: z.number() })
      .nullable()
      .describe("Where that part's printed callout sits in the same diagram, or null."),
    studs: z.object({
      along: z.number().nullable().describe("How many studs in from fromEdge. Null when you cannot count them. Never guess."),
      fromEdge: z.string().nullable().describe('The visible edge the count starts from, such as "left edge", or null.'),
      row: z.number().nullable().describe("Stud row counting from the front, 1 for the first row. Null when you cannot count."),
      onto: z.string().nullable().describe('The piece underneath, such as "blue 2x6", or null.'),
      relation: z.string().nullable().describe('How it meets that piece, such as "on top of", or null.'),
    }),
    poses: z
      .array(
        z.object({
          x: z.number().nullable().describe("Stud column from the left of the build. Null if you cannot see it."),
          y: z.number().nullable().describe("Stud row from the front of the build. Null if you cannot see it."),
          layer: z.number().nullable().describe("Plate-height layer, 0 at the table. A brick is 3 layers tall. Null if you cannot see it."),
          rotation: z.number().nullable().describe("0, 90, 180, or 270. Null if the turn is unclear. Do not snap a guess to 0."),
        }),
      )
      .describe("One pose for each physical copy of this part. Use null axes instead of copying a neighbor."),
    certainty: z.enum(["certain", "uncertain"]).describe("certain only when the spot, stud counts, rotation, and layer are all clear."),
    uncertainFields: z.array(z.enum(PLACEMENT_FIELDS)).describe("Which of point, studs, orientation, or layer could not be read."),
    note: z.string().nullable().describe('What is unclear, for example "can\'t count studs, photo angle", or null.'),
    needsRetake: z.boolean().describe("True when a closer, straighter photo would show the studs or the spot."),
    corrected: z.boolean().describe("Always false. The app sets this when a person moves the part."),
  }),
});

export const extractedStepSchema = z.object({
  stepNumber: z.number().describe("Printed step number."),
  description: z
    .string()
    .describe("Where the new pieces go. If that is not readable, say so. Do not invent a location."),
  parts: z.array(partSchema),
  region: regionSchema
    .nullable()
    .describe("Normalized 0-1 box of this step on the page, or null if it cannot be localized."),
  placementCertainty: z
    .enum(["certain", "uncertain"])
    .describe("uncertain when the attachment point is not readable. Do not guess a side or layer."),
  placementNote: z
    .string()
    .nullable()
    .describe("What is unclear about placement, or null when placement is certain."),
});

export const retakeSchema = z.object({
  needed: z
    .boolean()
    .describe("True when the photo is too blurry, dark, cropped, angled, or low-resolution to read reliably."),
  reasons: z
    .array(z.string())
    .describe('Short reasons such as "too blurry" or "step 4 cut off". Empty when a retake is not needed.'),
});

export const extractionSchema = z.object({
  pageSummary: z.string(),
  retake: retakeSchema,
  steps: z.array(extractedStepSchema),
});

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

export const EXTRACTION_INSTRUCTIONS = `You read one photographed page of an off-brand interlocking-brick instruction booklet.
Prefer uncertain over guessing. Do not guess.

Parts
- List only the NEW pieces added in that step.
- certainty is "certain" only when color, shape, size, and quantity are all clearly readable.
- If any of those is unclear, set certainty to "uncertain", list the unclear fields in uncertainFields, and explain in uncertaintyNote.
- For an unreadable color, shape, or size, write "Unclear". Do not substitute a likely color, and do not default the type to brick.
- For an unreadable quantity, use null. Do not assume 1.

Steps
- placementCertainty is "uncertain" when you cannot tell where the pieces go. Say that in placementNote. Do not invent a side, layer, or direction.
- region is that step's diagram on the page, as fractions from 0 to 1 (x, y, width, height), or null if you cannot localize it. A missing region is not a reason to invent placement.
- description is one or two short sentences in plain language. If the instruction cannot be read, say that it could not be read.

Where each new part goes
- Count studs. along is how many studs in from a visible edge (fromEdge, for example "left edge"). row is the stud row from the front, starting at 1. onto is the piece it sits on, such as "blue 2x6". relation is "on top of" when it stacks.
- poses has one entry per physical copy: x and y are studs from the left and the front, layer is the plate height (a brick is 3), rotation is 0, 90, 180, or 270.
- point and callout are fractions from 0 to 1 inside THIS step's diagram, not the whole page. point is the new part. callout is its printed label.
- Count only studs you can see. If a stud is hidden, the photo is angled, or you are not sure of the count, set that number to null. Do not estimate, and do not use 0 or 1 as a stand-in.
- certainty is "certain" only when the point, the stud counts, the rotation, and the layer are all clear. Otherwise "uncertain", and list point, studs, orientation, or layer in uncertainFields.
- note says what is unclear, for example "can't count studs, photo angle".
- needsRetake is true when a closer, straighter, brighter photo would let you count the studs or see the spot. Leave the numbers null in that case.
- corrected is always false.

Photo quality
- If the photo is too blurry, dark, cropped, angled, or low-resolution to read reliably, set retake.needed to true.
- reasons must name the problem in a few words, for example "too blurry" or "step 4 cut off".
- Still return any steps you can read without guessing. If nothing on the page is readable, return an empty steps array.
- Do not invent a typical build to hide a bad photo.`;

const UNCLEAR_TEXT =
  /^(unknown|unclear|unsure|n\/a|na|\?+|tbd|not sure|cannot tell|can't tell|unreadable|-+|none)$/i;
const DOUBT =
  /unsure|unclear|not sure|cannot tell|can't tell|hard to|too blurry|might be|maybe|difficult to|cut off|unreadable|guess/i;
const QUALITY_BAD =
  /blur|dark|crop|cut off|cutoff|angled|angle|low[-\s]?res|resolution|glare|shadow|unreadable|out of focus|too small/i;
const QUALITY_OK = /^(ok|okay|good|clear|fine|readable|sharp)$/i;
const KNOWN_SHAPES = new Set([
  "brick",
  "plate",
  "tile",
  "slope",
  "arch",
  "wheel",
  "window",
  "door",
  "round",
  "technic",
  "hinge",
  "bracket",
  "other",
]);

type Loose = Record<string, unknown>;

export function parseExtraction(
  input: unknown,
  options?: { previousMaxStep?: number },
): ParsedExtraction {
  const raw = unwrap(input);
  if (!raw) {
    throw new ExtractionError("The model did not return readable steps.");
  }

  const retake = readRetake(raw);
  const stepRows = readStepRows(raw);
  const steps = stepRows.map((row, index) => readStep(row, index));
  steps.sort((a, b) => a.stepNumber - b.stepNumber);
  const numbered = continueStepNumbers(steps, options?.previousMaxStep ?? 0);

  if (numbered.length === 0 && !retake.needed) {
    throw new ExtractionError("No build steps found on this page.");
  }

  const parsed = extractionSchema.parse({
    pageSummary: readString(raw.pageSummary ?? raw.summary) ?? "",
    retake,
    steps: numbered,
  });
  return parsed;
}

export function mockPageExtraction(pageOrder = 0): unknown {
  return {
    pageSummary: `Demo reading of page ${pageOrder + 1}. This was not taken from the photo.`,
    retake: { needed: false, reasons: [] },
    steps: [
      {
        stepNumber: 1,
        description:
          "Demo step: stack the new bricks on the previous layer, lining the studs up with the diagram.",
        placementCertainty: "certain",
        placementNote: null,
        region: { x: 0.06, y: 0.08, width: 0.88, height: 0.38 },
        parts: [
          {
            color: "Red",
            shape: "brick",
            size: "2x4",
            quantity: 2,
            certainty: "certain",
            uncertainFields: [],
            uncertaintyNote: null,
            placement: {
              point: { x: 0.4, y: 0.55 },
              callout: { x: 0.78, y: 0.28 },
              studs: { along: 2, fromEdge: "left edge", row: 1, onto: null, relation: null },
              poses: [{ x: 2, y: 0, layer: 0, rotation: 0 }],
              certainty: "certain",
              uncertainFields: [],
              note: null,
              needsRetake: false,
              corrected: false,
            },
          },
        ],
      },
      {
        stepNumber: 2,
        description: "Demo step: one callout on this page is not clear enough to name.",
        placementCertainty: "uncertain",
        placementNote: "Demo reading cannot see where this piece attaches.",
        region: { x: 0.06, y: 0.5, width: 0.88, height: 0.4 },
        parts: [
          {
            color: "Unclear",
            shape: "plate",
            size: "1x2",
            quantity: null,
            certainty: "uncertain",
            uncertainFields: ["color", "quantity"],
            uncertaintyNote: "Demo mode does not guess color or count from the photo.",
            placement: {
              point: null,
              callout: null,
              studs: { along: null, fromEdge: null, row: null, onto: null, relation: null },
              poses: [{ x: null, y: null, layer: null, rotation: null }],
              certainty: "uncertain",
              uncertainFields: ["point", "studs", "orientation", "layer"],
              note: "can't count studs, photo angle",
              needsRetake: true,
              corrected: false,
            },
          },
        ],
      },
    ],
  };
}

export function continueStepNumbers(steps: StepSpec[], previousMaxStep: number): StepSpec[] {
  if (previousMaxStep <= 0 || steps.length === 0) return steps;
  const min = Math.min(...steps.map((step) => step.stepNumber));
  if (min > previousMaxStep) return steps;
  const shift = previousMaxStep - min + 1;
  return steps.map((step) => ({ ...step, stepNumber: step.stepNumber + shift }));
}

function unwrap(input: unknown): Loose | null {
  if (typeof input === "string") {
    try {
      return unwrap(JSON.parse(input) as unknown);
    } catch {
      return null;
    }
  }
  if (Array.isArray(input)) return { steps: input };
  if (!input || typeof input !== "object") return null;
  return input as Loose;
}

function readStepRows(raw: Loose): Loose[] {
  const steps = raw.steps ?? raw.buildSteps ?? raw.items;
  if (!Array.isArray(steps)) return [];
  return steps.filter((step): step is Loose => Boolean(step) && typeof step === "object" && !Array.isArray(step));
}

function readStep(row: Loose, index: number): StepSpec {
  const printed = positiveInt(row.stepNumber ?? row.step_number ?? row.step ?? row.number);
  const descriptionRaw = readString(row.description ?? row.text ?? row.instruction ?? row.instructions);
  const unreadable = !descriptionRaw || UNCLEAR_TEXT.test(descriptionRaw);
  const description = unreadable ? "This step could not be read." : descriptionRaw;

  const partRows = row.parts ?? row.pieces ?? row.elements ?? row.callouts;
  const parts = Array.isArray(partRows)
    ? partRows
        .filter((part): part is Loose => Boolean(part) && typeof part === "object")
        .slice(0, 24)
        .map((part) => readPart(part))
    : [];

  const note = cleanNote(row.placementNote ?? row.placement_note ?? row.where);
  let placementCertainty = resolveCertainty(
    row.placementCertainty ?? row.placement_certainty ?? row.placementConfidence,
    note,
  );
  let placementNote = note;
  if (unreadable) {
    placementCertainty = "uncertain";
    placementNote = placementNote ?? "The step text could not be read.";
  }
  if (placementCertainty === "certain") placementNote = null;

  return {
    stepNumber: printed ?? index + 1,
    description,
    parts,
    region: readRegion(row.region ?? row.box ?? row.bbox ?? row.bounds),
    placementCertainty,
    placementNote,
  };
}

function readPart(row: Loose): PartSpec {
  const color = readLabel(row.color ?? row.colour, "color");
  const shape = readLabel(row.shape ?? row.type ?? row.kind, "shape");
  const size = readLabel(row.size ?? row.dimensions, "size");
  const quantity = readQuantity(row.quantity ?? row.qty ?? row.count);
  const note = cleanNote(row.uncertaintyNote ?? row.uncertainty_note ?? row.note ?? row.reason);
  const provided = readFields(row.uncertainFields ?? row.uncertain_fields ?? row.unclearFields);
  const forced: UncertainField[] = [];
  if (color.unclear) forced.push("color");
  if (shape.unclear) forced.push("shape");
  if (size.unclear) forced.push("size");
  if (quantity.unclear) forced.push("quantity");

  let certainty = resolveCertainty(row.certainty ?? row.confidence, note);
  const fields = uniqueFields([...provided, ...forced]);
  if (fields.length > 0) certainty = "uncertain";
  if (certainty === "certain") {
    return {
      color: color.text,
      shape: shape.text,
      size: size.text,
      quantity: quantity.quantity,
      certainty,
      uncertainFields: [],
      uncertaintyNote: null,
      placement: readPlacement(row),
    };
  }
  return {
    color: color.text,
    shape: shape.text,
    size: size.text,
    quantity: quantity.unclear ? null : quantity.quantity,
    certainty: "uncertain",
    uncertainFields: fields,
    uncertaintyNote: note,
    placement: readPlacement(row),
  };
}

function readPlacement(row: Loose): PartPlacement {
  const source = row.placement;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return unknownPlacement();
  }
  const bag = source as Loose;
  const note = cleanNote(bag.note ?? bag.uncertaintyNote);
  const studs = readStuds(bag.studs);
  const poses = readPoses(bag.poses ?? bag.positions);
  const point = readNormPoint(bag.point);
  const callout = readNormPoint(bag.callout);
  let fields = readPlacementFields(bag.uncertainFields);
  let certainty = resolveCertainty(bag.certainty, note);
  const needsRetake = bag.needsRetake === true || Boolean(note && QUALITY_BAD.test(note));
  if (note && /can(?:not|'t)\s+count/i.test(note)) fields = addField(fields, "studs");
  const located = poses.some((pose) => pose.x != null && pose.y != null && pose.layer != null && pose.rotation != null);
  if (studs.along == null || studs.row == null) fields = addField(fields, "studs");
  if (!located) {
    fields = addField(fields, "point");
    if (poses.length === 0 || poses.every((pose) => pose.rotation == null)) fields = addField(fields, "orientation");
    if (poses.length === 0 || poses.every((pose) => pose.layer == null)) fields = addField(fields, "layer");
  }
  if (needsRetake || fields.length > 0) certainty = "uncertain";
  if (certainty === "uncertain" && fields.includes("studs")) {
    studs.along = null;
    studs.row = null;
  }
  fields = PLACEMENT_FIELDS.filter((field) => fields.includes(field));
  if (certainty === "certain") {
    return {
      point,
      callout,
      studs,
      poses,
      certainty,
      uncertainFields: [],
      note: null,
      needsRetake: false,
      corrected: false,
    };
  }
  return {
    point: fields.includes("point") ? null : point,
    callout: fields.includes("point") ? null : callout,
    studs,
    poses,
    certainty: "uncertain",
    uncertainFields: fields,
    note,
    needsRetake,
    corrected: false,
  };
}

function readStuds(value: unknown): StudOffset {
  const bag = value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
  return {
    along: readStudNumber(bag.along ?? bag.x),
    fromEdge: cleanShort(bag.fromEdge ?? bag.from ?? bag.reference),
    row: readStudNumber(bag.row ?? bag.y),
    onto: cleanShort(bag.onto),
    relation: cleanShort(bag.relation),
  };
}

function readPoses(value: unknown): StudPose[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 24).flatMap((item) => {
    const pose = readPose(item);
    return pose ? [pose] : [];
  });
}

function readPose(value: unknown): StudPose | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const bag = value as Loose;
  return {
    x: readStudNumber(bag.x),
    y: readStudNumber(bag.y),
    layer: readStudNumber(bag.layer),
    rotation: readRotation(bag.rotation),
  };
}

function readRotation(value: unknown): number | null {
  const number = readStudNumber(value);
  if (number == null) return null;
  const wrapped = ((number % 360) + 360) % 360;
  if (wrapped % 90 !== 0) return null;
  return wrapped;
}

function readNormPoint(value: unknown): NormPoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const bag = value as Loose;
  let x = numberOrNaN(bag.x);
  let y = numberOrNaN(bag.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.max(Math.abs(x), Math.abs(y)) > 1.5) {
    x /= 100;
    y /= 100;
  }
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  return { x, y };
}

function readStudNumber(value: unknown): number | null {
  if (typeof value === "string" && (!value.trim() || UNCLEAR_TEXT.test(value.trim()))) return null;
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (Math.abs(rounded) > 80) return null;
  return rounded;
}

function readPlacementFields(value: unknown): PlacementUncertainField[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(PLACEMENT_FIELDS);
  return value.filter((field): field is PlacementUncertainField => typeof field === "string" && allowed.has(field));
}

function addField(fields: PlacementUncertainField[], field: PlacementUncertainField): PlacementUncertainField[] {
  return fields.includes(field) ? fields : [...fields, field];
}

function cleanShort(value: unknown): string | null {
  const text = readString(value);
  if (!text || UNCLEAR_TEXT.test(text)) return null;
  return text.slice(0, 80);
}

function readRetake(raw: Loose): RetakeFlag {
  const reasons: string[] = [];
  let needed = false;
  let explicit = false;

  const retake = raw.retake ?? raw.retakeNeeded ?? raw.retake_needed;
  if (typeof retake === "boolean") {
    needed = retake;
    explicit = true;
  } else if (typeof retake === "string") {
    const text = retake.trim();
    if (text && !QUALITY_OK.test(text) && !/^false|no$/i.test(text)) {
      needed = true;
      reasons.push(text);
    }
    explicit = true;
  } else if (retake && typeof retake === "object") {
    const bag = retake as Loose;
    if (typeof bag.needed === "boolean") {
      needed = bag.needed;
      explicit = true;
    }
    pushReasons(reasons, bag.reasons ?? bag.reason ?? bag.issues);
  }

  const quality = readString(raw.photoQuality ?? raw.photo_quality ?? raw.quality ?? raw.imageQuality);
  if (quality && !QUALITY_OK.test(quality)) {
    if (QUALITY_BAD.test(quality) || !explicit) {
      if (QUALITY_BAD.test(quality)) needed = true;
    }
    if (QUALITY_BAD.test(quality)) reasons.unshift(quality);
  }

  const unique = dedupe(reasons).slice(0, 8).map((reason) => reason.slice(0, 140));
  if (needed && unique.length === 0) unique.push("photo is too hard to read");
  if (!needed) return { needed: false, reasons: [] };
  return { needed: true, reasons: unique };
}

function resolveCertainty(value: unknown, note: string | null): Certainty {
  const flagged = certaintyValue(value);
  const doubtful = Boolean(note && DOUBT.test(note));
  if (flagged === "uncertain" || doubtful) return "uncertain";
  return "certain";
}

function certaintyValue(value: unknown): Certainty | null {
  if (typeof value === "number") return value < 0.8 ? "uncertain" : "certain";
  if (typeof value !== "string") return null;
  const token = value.trim().toLowerCase();
  if (["uncertain", "unsure", "low", "unknown", "guess", "unclear"].includes(token)) return "uncertain";
  if (["certain", "sure", "high", "confident", "clear"].includes(token)) return "certain";
  const numeric = Number(token);
  if (Number.isFinite(numeric) && token !== "") return numeric < 0.8 ? "uncertain" : "certain";
  return null;
}

function readLabel(value: unknown, kind: "color" | "shape" | "size"): { text: string; unclear: boolean } {
  if (typeof value !== "string") return { text: "Unclear", unclear: true };
  const trimmed = value.trim();
  if (!trimmed || UNCLEAR_TEXT.test(trimmed)) return { text: "Unclear", unclear: true };
  if (kind === "color") return { text: titleCase(trimmed), unclear: false };
  if (kind === "size") return { text: normalizeSize(trimmed), unclear: false };
  return { text: normalizeShape(trimmed), unclear: false };
}

function readQuantity(value: unknown): { quantity: number | null; unclear: boolean } {
  if (value == null) return { quantity: null, unclear: true };
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || UNCLEAR_TEXT.test(trimmed)) return { quantity: null, unclear: true };
  }
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return { quantity: null, unclear: true };
  return { quantity: Math.min(500, Math.round(numeric)), unclear: false };
}

function readFields(value: unknown): UncertainField[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(UNCERTAIN_FIELDS);
  return value.filter((field): field is UncertainField => typeof field === "string" && allowed.has(field));
}

function readRegion(value: unknown) {
  if (Array.isArray(value) && value.length >= 4) {
    return clampRegion({
      x: numberOrNaN(value[0]),
      y: numberOrNaN(value[1]),
      width: numberOrNaN(value[2]),
      height: numberOrNaN(value[3]),
    });
  }
  if (!value || typeof value !== "object") return null;
  const box = value as Loose;
  return clampRegion({
    x: numberOrNaN(box.x ?? box.left),
    y: numberOrNaN(box.y ?? box.top),
    width: numberOrNaN(box.width ?? box.w),
    height: numberOrNaN(box.height ?? box.h),
  });
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanNote(value: unknown): string | null {
  const text = readString(value);
  if (!text || UNCLEAR_TEXT.test(text)) return null;
  return text.slice(0, 280);
}

function positiveInt(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric);
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeSize(value: string): string {
  return value
    .replace(/[×✕]/g, "x")
    .replace(/\s*[xX]\s*/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeShape(value: string): string {
  const lower = value.toLowerCase();
  if (KNOWN_SHAPES.has(lower)) return lower;
  return value.trim();
}

function uniqueFields(fields: UncertainField[]): UncertainField[] {
  const seen = new Set<UncertainField>();
  const ordered: UncertainField[] = [];
  for (const field of UNCERTAIN_FIELDS) {
    if (fields.includes(field) && !seen.has(field)) {
      seen.add(field);
      ordered.push(field);
    }
  }
  return ordered;
}

function pushReasons(target: string[], value: unknown) {
  if (typeof value === "string") {
    const text = value.trim();
    if (text) target.push(text);
    return;
  }
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (typeof item === "string" && item.trim()) target.push(item.trim());
  }
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function numberOrNaN(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}
