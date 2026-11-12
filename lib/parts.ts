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
  black: "#3a3a3a",
  "dark bluish gray": "#5b6772",
  "dark bluish grey": "#5b6772",
  "dark brown": "#5c4334",
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

export type BrickPaint = {
  fill: string;
  edge: string;
  stud: string;
  dark: boolean;
};

const DARK_NAMES = new Set([
  "black",
  "dark gray",
  "dark grey",
  "dark bluish gray",
  "dark bluish grey",
  "dark brown",
]);

export function brickPaint(color: string): BrickPaint {
  const name = color.trim().toLowerCase();
  const base = colorHex(color) ?? "#c4b8a8";
  const dark = DARK_NAMES.has(name) || relativeLuminance(base) < 0.08;
  if (!dark) return { fill: base, edge: "#241910", stud: base, dark: false };
  const fill = relativeLuminance(base) < 0.02 ? liftToLuminance(base, 0.04) : base;
  return { fill, edge: mix(fill, "#ffffff", 0.58), stud: mix(fill, "#ffffff", 0.36), dark: true };
}

function relativeLuminance(hex: string): number {
  const channels = rgb(hex);
  if (!channels) return 1;
  const [r, g, b] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function liftToLuminance(hex: string, target: number): string {
  let current = hex;
  for (let step = 0; step < 8 && relativeLuminance(current) < target; step += 1) {
    current = mix(current, "#ffffff", 0.18);
  }
  return current;
}

function mix(hex: string, other: string, amount: number): string {
  const left = rgb(hex);
  const right = rgb(other);
  if (!left || !right) return hex;
  const channels = left.map((channel, index) => Math.round(channel + (right[index] - channel) * amount));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function rgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) return null;
  const raw = match[1];
  return [0, 2, 4].map((start) => Number.parseInt(raw.slice(start, start + 2), 16)) as [number, number, number];
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
