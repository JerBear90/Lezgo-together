import type { BrickSet, PartSpec, StepSpec, UncertainField } from "./types";

export function uncertaintyLabel(
  part: Pick<PartSpec, "certainty" | "uncertainFields" | "uncertaintyNote">,
): string | null {
  if (part.certainty !== "uncertain") return null;
  const fields = fieldList(part.uncertainFields);
  const head = fields ? `Unsure: ${fields}` : "Unsure";
  const note = part.uncertaintyNote?.trim();
  return note ? `${head}. ${note}` : `${head}.`;
}

export function placementLabel(
  step: Pick<StepSpec, "placementCertainty" | "placementNote">,
): string | null {
  if (step.placementCertainty !== "uncertain") return null;
  const note = step.placementNote?.trim();
  return note ? `Unsure where this goes. ${note}` : "Unsure where this goes.";
}

export function retakeMessage(
  retake: { needed: boolean; reasons: string[] } | null | undefined,
): string | null {
  if (!retake?.needed) return null;
  const reasons = retake.reasons.map((reason) => reason.trim()).filter(Boolean);
  if (reasons.length === 0) {
    return "This photo is too hard to read. Take a closer, brighter, straight-on shot of the whole page.";
  }
  return reasons.map(sentence).join(" ");
}

export function attentionCounts(set: Pick<BrickSet, "pages" | "steps">): {
  retakes: number;
  unsureParts: number;
  unsureSteps: number;
} {
  return {
    retakes: set.pages.filter((page) => page.retake?.needed).length,
    unsureParts: set.steps.reduce(
      (count, step) => count + step.parts.filter((part) => part.certainty === "uncertain").length,
      0,
    ),
    unsureSteps: set.steps.filter((step) => step.placementCertainty === "uncertain").length,
  };
}

export function canMarkPartCertain(
  part: Pick<PartSpec, "color" | "shape" | "size" | "quantity">,
): boolean {
  return (
    part.color !== "Unclear" &&
    part.shape !== "Unclear" &&
    part.size !== "Unclear" &&
    part.quantity != null
  );
}

function fieldList(fields: UncertainField[]): string {
  if (fields.length === 0) return "";
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`;
}

function sentence(reason: string): string {
  const trimmed = reason.trim().replace(/[.!?]+$/g, "");
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return `${capped}.`;
}
