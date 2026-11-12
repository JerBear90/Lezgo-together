import type { BuildStep, Certainty, PartSpec, UncertainField } from "./types";

export type RolledPart = {
  key: string;
  color: string;
  shape: string;
  size: string;
  quantity: number | null;
  certainty: Certainty;
  uncertainFields: UncertainField[];
  uncertaintyNotes: string[];
  stepNumbers: number[];
};

const COLOR_HEX: Record<string, string> = {
  red: "#e23b2f",
  blue: "#2f6fdd",
  "dark blue": "#1d3f86",
  "light blue": "#8eb6f5",
  yellow: "#f0c445",
  black: "#241910",
  white: "#f7f4ee",
  green: "#2f8a55",
  "dark green": "#1d5a38",
  orange: "#ef7d2a",
  brown: "#8a5a32",
  tan: "#d7b48a",
  gray: "#8d847a",
  grey: "#8d847a",
  "light gray": "#d5d0c8",
  "light grey": "#d5d0c8",
  "dark gray": "#4e4944",
  "dark grey": "#4e4944",
};

export function rollupParts(steps: BuildStep[]): RolledPart[] {
  const map = new Map<string, RolledPart>();
  for (const step of steps) {
    for (const part of step.parts) {
      const key = `${part.color.toLowerCase()}|${part.shape.toLowerCase()}|${part.size.toLowerCase()}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          color: part.color,
          shape: part.shape,
          size: part.size,
          quantity: part.quantity,
          certainty: part.certainty,
          uncertainFields: [...part.uncertainFields],
          uncertaintyNotes: notesFrom(part),
          stepNumbers: [step.stepNumber],
        });
        continue;
      }
      if (!existing.stepNumbers.includes(step.stepNumber)) existing.stepNumbers.push(step.stepNumber);
      existing.quantity = addQuantity(existing.quantity, part.quantity);
      if (part.certainty === "uncertain") existing.certainty = "uncertain";
      for (const field of part.uncertainFields) {
        if (!existing.uncertainFields.includes(field)) existing.uncertainFields.push(field);
      }
      for (const note of notesFrom(part)) {
        if (!existing.uncertaintyNotes.includes(note)) existing.uncertaintyNotes.push(note);
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.certainty !== b.certainty) return a.certainty === "uncertain" ? -1 : 1;
    return a.color.localeCompare(b.color) || a.size.localeCompare(b.size) || a.shape.localeCompare(b.shape);
  });
}

export function colorHex(color: string): string | null {
  if (color.trim().toLowerCase() === "unclear") return null;
  return COLOR_HEX[color.trim().toLowerCase()] ?? null;
}

export function quantityLabel(quantity: number | null): string {
  return quantity == null ? "×?" : `×${quantity}`;
}

function notesFrom(part: Pick<PartSpec, "certainty" | "uncertaintyNote">): string[] {
  if (part.certainty !== "uncertain") return [];
  const note = part.uncertaintyNote?.trim();
  return note ? [note] : [];
}

function addQuantity(left: number | null, right: number | null): number | null {
  if (left == null || right == null) return null;
  return left + right;
}
