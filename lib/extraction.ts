import { z } from "zod";
import { clampRegion } from "./region";
import {
  UNCERTAIN_FIELDS,
  type Certainty,
  type ParsedExtraction,
  type PartSpec,
  type RetakeFlag,
  type StepSpec,
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
  };
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
