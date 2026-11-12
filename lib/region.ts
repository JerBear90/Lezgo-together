import type { Region } from "./types";

export function clampRegion(region: Region): Region | null {
  let { x, y, width, height } = region;
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  if (Math.max(x, y, width, height) > 1.5) {
    x /= 100;
    y /= 100;
    width /= 100;
    height /= 100;
  }
  x = clamp01(x);
  y = clamp01(y);
  width = clamp01(width);
  height = clamp01(height);
  if (x + width > 1) width = 1 - x;
  if (y + height > 1) height = 1 - y;
  if (width < 0.02 || height < 0.02) return null;
  return { x, y, width, height };
}

export function unionRegion(a: Region | null, b: Region | null): Region | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return clampRegion({ x, y, width: right - x, height: bottom - y });
}

export function splitRegion(region: Region | null, half: "top" | "bottom"): Region | null {
  if (!region) return null;
  const height = region.height / 2;
  const y = half === "top" ? region.y : region.y + height;
  return clampRegion({ x: region.x, y, width: region.width, height });
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
