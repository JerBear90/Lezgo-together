/**
 * Canonical part numbers for the pieces Lezgo knows how to draw.
 * Numbers are LDraw / BrickLink design ids. Colors are LDraw color numbers.
 * A shape that is not in this table stays unidentified. Nothing here guesses a nearby part.
 */

export type CatalogPart = {
  id: string;
  name: string;
};

const PARTS: Record<string, CatalogPart> = {
  "brick|1x1": { id: "3005", name: "Brick 1 x 1" },
  "brick|1x2": { id: "3004", name: "Brick 1 x 2" },
  "brick|1x4": { id: "3010", name: "Brick 1 x 4" },
  "brick|2x2": { id: "3003", name: "Brick 2 x 2" },
  "brick|2x4": { id: "3001", name: "Brick 2 x 4" },
  "plate|2x4": { id: "3020", name: "Plate 2 x 4" },
  "plate|4x6": { id: "3032", name: "Plate 4 x 6" },
  "tile|1x1": { id: "3070b", name: "Tile 1 x 1" },
  "tile|1x2": { id: "3069b", name: "Tile 1 x 2" },
  "slope|1x2": { id: "3040b", name: "Slope Brick 45 2 x 1" },
  "round|2x2": { id: "3941", name: "Brick 2 x 2 Round" },
};

const COLORS: Record<string, number> = {
  black: 0,
  blue: 1,
  green: 2,
  red: 4,
  brown: 6,
  "light blue": 9,
  yellow: 14,
  white: 15,
  tan: 19,
  orange: 25,
  "light gray": 71,
  "light grey": 71,
  gray: 71,
  grey: 71,
  "dark gray": 72,
  "dark grey": 72,
  "dark blue": 272,
  "dark green": 288,
};

export function lookupPart(shape: string, size: string): CatalogPart | null {
  const key = `${shape.trim().toLowerCase()}|${normalizeSize(size)}`;
  return PARTS[key] ?? null;
}

export function lookupColor(color: string): number | null {
  const name = color.trim().toLowerCase();
  if (!name || name === "unclear") return null;
  return COLORS[name] ?? null;
}

export function footprint(size: string, rotation: number): { w: number; d: number } {
  const match = /(\d+)\s*x\s*(\d+)/i.exec(normalizeSize(size));
  let w = match ? Number(match[1]) : 1;
  let d = match ? Number(match[2]) : 1;
  const turn = ((Math.round(rotation) % 360) + 360) % 360;
  if (turn === 90 || turn === 270) {
    const swap = w;
    w = d;
    d = swap;
  }
  return { w, d };
}

/** Height in plate units. A brick is three plates tall. */
export function plateLayers(shape: string): number {
  const name = shape.trim().toLowerCase();
  if (name === "plate" || name === "tile") return 1;
  return 3;
}

function normalizeSize(size: string): string {
  return size
    .replace(/[×✕]/g, "x")
    .replace(/\s*[xX]\s*/g, "x")
    .trim()
    .toLowerCase();
}
