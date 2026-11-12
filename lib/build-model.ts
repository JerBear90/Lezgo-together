import { footprint, lookupColor, lookupPart } from "./catalog";
import { poseComplete } from "./placement";
import type { BuildStep, Part, StudPose } from "./types";

export type BrickInstance = {
  key: string;
  stepId: string;
  partId: string;
  poseIndex: number;
  ldrawId: string | null;
  ldrawName: string | null;
  ldrawColor: number | null;
  color: string;
  shape: string;
  size: string;
  x: number | null;
  y: number | null;
  layer: number | null;
  rotation: number | null;
  confident: boolean;
  note: string | null;
  needsRetake: boolean;
  isNew: boolean;
};

export type BuildScene = {
  bricks: BrickInstance[];
};

/**
 * Fold steps up to and including the current one.
 * A brick is placed only when its id, color, stud position, and rotation are all known.
 * Anything else becomes one ghost with no stud coordinate, never a guessed brick.
 */
export function buildScene(steps: BuildStep[], currentStepId: string | null): BuildScene {
  const index = currentStepId ? steps.findIndex((step) => step.id === currentStepId) : steps.length - 1;
  const end = index < 0 ? -1 : index;
  const bricks: BrickInstance[] = [];
  steps.slice(0, end + 1).forEach((step) => {
    const isNew = step.id === currentStepId;
    for (const part of step.parts) {
      bricks.push(...instancesFor(step, part, isNew));
    }
  });
  return { bricks };
}

export function ghostAnchor(
  ghostIndex: number,
  confident: Array<Pick<BrickInstance, "x" | "size" | "rotation">>,
): { x: number; y: number; layer: number } {
  let maxX = 0;
  for (const brick of confident) {
    if (brick.x == null) continue;
    maxX = Math.max(maxX, brick.x + footprint(brick.size, brick.rotation ?? 0).w);
  }
  return { x: maxX + 2, y: ghostIndex * 3, layer: 0 };
}

function instancesFor(step: BuildStep, part: Part, isNew: boolean): BrickInstance[] {
  const catalog = lookupPart(part.shape, part.size);
  const colorId = lookupColor(part.color);
  const poses = confidentPoses(part);
  if (poses) {
    const copies = part.quantity == null ? poses.length : Math.min(part.quantity, poses.length);
    const placed = poses.slice(0, copies).map((pose, poseIndex) =>
      instance(step, part, poseIndex, pose, {
        confident: true,
        isNew,
        ldrawId: catalog?.id ?? null,
        ldrawName: catalog?.name ?? null,
        ldrawColor: colorId,
        note: null,
      }),
    );
    const missing = part.quantity == null ? 0 : part.quantity - copies;
    if (missing <= 0) return placed;
    return [
      ...placed,
      ghost(step, part, copies, isNew, `${missing} more ${missing === 1 ? "copy has" : "copies have"} no stud position.`),
    ];
  }
  const reason =
    part.placement.note?.trim() ||
    (!catalog ? "No standard part matches this shape." : !colorId ? "The color has no standard id." : "The stud position is unclear.");
  return [ghost(step, part, 0, isNew, reason)];
}

function confidentPoses(part: Part): Array<Required<Pick<StudPose, "x" | "y" | "layer" | "rotation">>> | null {
  if (part.certainty !== "certain") return null;
  if (part.placement.certainty !== "certain" || part.placement.needsRetake || part.placement.uncertainFields.length > 0) {
    return null;
  }
  if (!lookupPart(part.shape, part.size) || lookupColor(part.color) == null) return null;
  if (part.placement.studs.along == null || part.placement.studs.row == null) return null;
  const poses = part.placement.poses.filter(poseComplete) as Array<
    Required<Pick<StudPose, "x" | "y" | "layer" | "rotation">>
  >;
  if (poses.length === 0) return null;
  return poses;
}

function ghost(step: BuildStep, part: Part, poseIndex: number, isNew: boolean, note: string): BrickInstance {
  return instance(step, part, poseIndex, { x: null, y: null, layer: null, rotation: null }, {
    confident: false,
    isNew,
    ldrawId: null,
    ldrawName: lookupPart(part.shape, part.size)?.name ?? null,
    ldrawColor: null,
    note,
  });
}

function instance(
  step: BuildStep,
  part: Part,
  poseIndex: number,
  pose: StudPose,
  flags: {
    confident: boolean;
    isNew: boolean;
    ldrawId: string | null;
    ldrawName: string | null;
    ldrawColor: number | null;
    note: string | null;
  },
): BrickInstance {
  return {
    key: `${part.id}:${poseIndex}`,
    stepId: step.id,
    partId: part.id,
    poseIndex,
    ldrawId: flags.ldrawId,
    ldrawName: flags.ldrawName,
    ldrawColor: flags.ldrawColor,
    color: part.color,
    shape: part.shape,
    size: part.size,
    x: flags.confident ? pose.x : null,
    y: flags.confident ? pose.y : null,
    layer: flags.confident ? pose.layer : null,
    rotation: flags.confident ? pose.rotation : null,
    confident: flags.confident,
    note: flags.note,
    needsRetake: part.placement.needsRetake,
    isNew: flags.isNew,
  };
}
