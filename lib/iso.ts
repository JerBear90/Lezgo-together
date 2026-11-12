import { footprint, plateLayers } from "./catalog";
import { ghostAnchor, type BrickInstance, type BuildScene } from "./build-model";
import { brickPaint } from "./parts";

export type DisplayBrick = BrickInstance & {
  displayX: number;
  displayY: number;
  displayLayer: number;
};

export type DrawnFace = {
  key: string;
  points: string;
  fill: string;
  opacity: number;
  stroke: string;
  dashed: boolean;
};

export type SceneMarker = {
  key: string;
  partId: string;
  poseIndex: number;
  label: string;
  tipX: number;
  tipY: number;
  tailX: number;
  tailY: number;
  ghost: boolean;
  note: string | null;
  modelX: number | null;
  modelY: number | null;
};

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);

export function displayBricks(scene: BuildScene): DisplayBrick[] {
  const confident = scene.bricks.filter((brick) => brick.confident);
  let ghosts = 0;
  return scene.bricks.map((brick) => {
    if (brick.confident && brick.x != null && brick.y != null && brick.layer != null) {
      return { ...brick, displayX: brick.x, displayY: brick.y, displayLayer: brick.layer };
    }
    const anchor = ghostAnchor(ghosts, confident);
    ghosts += 1;
    return { ...brick, displayX: anchor.x, displayY: anchor.y, displayLayer: anchor.layer };
  });
}

export function layoutScene(scene: BuildScene): { faces: DrawnFace[]; markers: SceneMarker[] } {
  const bricks = displayBricks(scene);
  const projected = bricks.map((brick) => ({ brick, ...brickBounds(brick) }));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const item of projected) {
    for (const point of item.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (!Number.isFinite(minX)) {
    return { faces: [], markers: [] };
  }
  const pad = 12;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = (100 - pad * 2) / Math.max(spanX, spanY);
  const offsetX = pad + ((100 - pad * 2) - spanX * scale) / 2;
  const offsetY = pad + ((100 - pad * 2) - spanY * scale) / 2;
  const map = (point: { x: number; y: number }) => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (point.y - minY) * scale,
  });

  const faces: DrawnFace[] = [];
  const markers: SceneMarker[] = [];
  projected.forEach((item, index) => {
    const top = item.points.slice(0, 4).map(map);
    const left = item.points.slice(4, 8).map(map);
    const right = item.points.slice(8, 12).map(map);
    const paint = brickPaint(item.brick.color);
    const fill = item.brick.confident ? paint.fill : "#d9cbb6";
    const opacity = item.brick.confident ? (item.brick.isNew ? 1 : paint.dark ? 0.82 : 0.45) : 1;
    const stroke = item.brick.confident ? (item.brick.isNew ? "#c4b5fd" : paint.dark ? paint.edge : "#241910") : "#c4922a";
    const dashed = !item.brick.confident;
    faces.push(face(`${item.brick.key}-left`, left, shade(fill, 0.72), opacity, stroke, dashed));
    faces.push(face(`${item.brick.key}-right`, right, shade(fill, 0.55), opacity, stroke, dashed));
    faces.push(face(`${item.brick.key}-top`, top, fill, opacity, stroke, dashed));
    const tip = map(item.topCenter);
    const tail = {
      x: clamp(tip.x - 18 - (index % 3) * 4, 4, 96),
      y: clamp(tip.y - 16, 4, 96),
    };
    if (item.brick.isNew) {
      markers.push({
        key: item.brick.key,
        partId: item.brick.partId,
        poseIndex: item.brick.poseIndex,
        label: item.brick.ldrawId ? `${item.brick.color} ${item.brick.size}` : item.brick.color,
        tipX: tip.x,
        tipY: tip.y,
        tailX: tail.x,
        tailY: tail.y,
        ghost: !item.brick.confident,
        note: item.brick.note,
        modelX: item.brick.x,
        modelY: item.brick.y,
      });
    }
  });
  return { faces, markers };
}

function brickBounds(brick: DisplayBrick) {
  const { w, d } = footprint(brick.size, brick.rotation ?? 0);
  const height = plateLayers(brick.shape) * 0.4;
  const x = brick.displayX;
  const y = brick.displayY;
  const z = brick.displayLayer * 0.4;
  const top = [
    iso(x, y, z + height),
    iso(x + w, y, z + height),
    iso(x + w, y + d, z + height),
    iso(x, y + d, z + height),
  ];
  const left = [iso(x, y + d, z), iso(x, y + d, z + height), iso(x + w, y + d, z + height), iso(x + w, y + d, z)];
  const right = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + height), iso(x + w, y, z + height)];
  return {
    points: [...top, ...left, ...right],
    topCenter: iso(x + w / 2, y + d / 2, z + height),
    fill: brickFill(brick.color),
  };
}

function iso(x: number, y: number, z: number): { x: number; y: number } {
  return { x: (x - y) * COS, y: (x + y) * SIN - z };
}

function face(key: string, points: { x: number; y: number }[], fill: string, opacity: number, stroke: string, dashed: boolean): DrawnFace {
  return {
    key,
    points: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "),
    fill,
    opacity,
    stroke,
    dashed,
  };
}

function brickFill(color: string): string {
  return brickPaint(color).fill;
}

function shade(hex: string, amount: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) return hex;
  const raw = match[1];
  const channels = [0, 2, 4].map((start) => Math.round(Number.parseInt(raw.slice(start, start + 2), 16) * amount));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
