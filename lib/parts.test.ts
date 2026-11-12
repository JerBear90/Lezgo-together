import { describe, expect, it } from "vitest";
import { brickPaint, colorHex } from "./parts";

function channel(hex: string): number {
  return Number.parseInt(hex.slice(1, 3), 16);
}

describe("dark brick paint", () => {
  it("paints black as charcoal with a lighter rim and stud", () => {
    const paint = brickPaint("Black");
    expect(paint.dark).toBe(true);
    expect(paint.fill).toBe("#3a3a3a");
    expect(paint.fill).not.toBe("#000000");
    expect(channel(paint.edge)).toBeGreaterThan(channel(paint.fill));
    expect(channel(paint.stud)).toBeGreaterThan(channel(paint.fill));
    expect(channel(paint.edge)).toBeGreaterThan(channel(paint.stud));
    expect(colorHex("black")).toBe("#3a3a3a");
  });

  it("treats dark bluish gray and dark brown the same way, and leaves red alone", () => {
    expect(brickPaint("dark bluish gray").dark).toBe(true);
    expect(brickPaint("dark brown").dark).toBe(true);
    expect(brickPaint("dark brown").fill).not.toBe("#000000");
    const red = brickPaint("Red");
    expect(red.dark).toBe(false);
    expect(red.fill).toBe(colorHex("Red"));
    expect(red.edge).toBe("#241910");
  });
});
