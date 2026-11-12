import type {
  NormPoint,
  PartPlacement,
  PartSpec,
  PlacementUncertainField,
  StudOffset,
  StudPose,
} from "./types";

export function emptyStuds(): StudOffset {
  return { along: null, fromEdge: null, row: null, onto: null, relation: null };
}

export function unknownPlacement(note = "The spot and stud count were not provided."): PartPlacement {
  return {
    point: null,
    callout: null,
    studs: emptyStuds(),
    poses: [],
    certainty: "uncertain",
    uncertainFields: ["point", "studs", "orientation", "layer"],
    note,
    needsRetake: false,
    corrected: false,
  };
}

export function canDrawArrow(part: Pick<PartSpec, "certainty" | "placement">): boolean {
  if (part.certainty !== "certain") return false;
  const placement = part.placement;
  if (placement.certainty !== "certain" || placement.needsRetake || placement.uncertainFields.length > 0) {
    return false;
  }
  if (placement.studs.along == null || placement.studs.row == null) return false;
  return placement.poses.some(
    (pose) => pose.x != null && pose.y != null && pose.layer != null && pose.rotation != null,
  );
}

export function canDrawPhotoArrow(part: Pick<PartSpec, "certainty" | "placement">): boolean {
  return canDrawArrow(part) && part.placement.point != null && part.placement.callout != null;
}

export function formatStudPlacement(
  part: Pick<PartSpec, "color" | "size" | "placement">,
): string | null {
  const placement = part.placement;
  if (placement.uncertainFields.includes("studs")) return null;
  const { along, row, fromEdge, onto, relation } = placement.studs;
  if (along == null || row == null) return null;
  if (placement.note && /can(?:not|'t)\s+count|not sure of the count/i.test(placement.note)) return null;
  const edge = fromEdge?.trim() || "left edge";
  const name = `${part.color} ${part.size}`.trim();
  const offset =
    along === 0
      ? `flush with the ${edge}`
      : `place ${Math.abs(along)} ${Math.abs(along) === 1 ? "stud" : "studs"} in from the ${edge}`;
  let text = `${name}: ${offset}, ${ordinal(row)} row from the front`;
  if (onto && relation) text += `, ${relation} the ${onto}`;
  else if (onto) text += `, on top of the ${onto}`;
  return `${text}.`;
}

export function placementUncertaintyLabel(part: Pick<PartSpec, "placement">): string | null {
  const placement = part.placement;
  if (placement.certainty !== "uncertain" && placement.uncertainFields.length === 0 && !placement.needsRetake) {
    return null;
  }
  const fields = placement.uncertainFields.map(fieldLabel);
  const head = fields.length > 0 ? `Unsure: ${joinFields(fields)}` : "Unsure";
  const note = placement.note?.trim();
  return note ? `${head}. ${note}` : `${head}.`;
}

export function shiftPose(
  placement: PartPlacement,
  poseIndex: number,
  axis: "x" | "y",
  delta: number,
): PartPlacement {
  const poses = placement.poses.map((pose, index) => {
    if (index !== poseIndex) return pose;
    const current = pose[axis];
    return { ...pose, [axis]: (current ?? 0) + delta };
  });
  const studs = { ...placement.studs };
  if (axis === "x" && studs.along != null) studs.along += delta;
  if (axis === "y" && studs.row != null) studs.row = Math.max(1, studs.row + delta);
  const point = nudgePoint(placement.point, axis, delta);
  return { ...placement, poses, studs, point, corrected: true };
}

export function nudgeStud(placement: PartPlacement, axis: "along" | "row", delta: number): PartPlacement {
  const current = placement.studs[axis];
  const next = axis === "row" ? Math.max(1, (current ?? 1) + delta) : (current ?? 0) + delta;
  const studs = {
    ...placement.studs,
    [axis]: next,
    fromEdge: placement.studs.fromEdge ?? "left edge",
  };
  const poseAxis = axis === "along" ? "x" : "y";
  const poses = placement.poses.map((pose, index) => {
    if (index !== 0 || pose[poseAxis] == null || current == null) return pose;
    return { ...pose, [poseAxis]: (pose[poseAxis] as number) + (next - current) };
  });
  const uncertainFields = placement.uncertainFields.filter((field) => field !== "studs");
  return {
    ...placement,
    studs,
    poses,
    uncertainFields,
    note: uncertainFields.length === 0 ? null : placement.note,
    certainty: uncertainFields.length === 0 ? "certain" : placement.certainty,
    corrected: true,
  };
}

function nudgePoint(point: NormPoint | null, axis: "x" | "y", delta: number): NormPoint | null {
  if (!point) return point;
  const next = axis === "x" ? point.x + delta * 0.04 : point.y + delta * 0.04;
  return {
    x: clamp01(axis === "x" ? next : point.x),
    y: clamp01(axis === "y" ? next : point.y),
  };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function ordinal(value: number): string {
  const number = Math.abs(Math.round(value));
  const mod100 = number % 100;
  const mod10 = number % 10;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? "th" : mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th";
  return `${number}${suffix}`;
}

function fieldLabel(field: PlacementUncertainField): string {
  if (field === "point") return "spot";
  if (field === "studs") return "stud count";
  if (field === "orientation") return "rotation";
  return "layer";
}

function joinFields(fields: string[]): string {
  if (fields.length === 1) return fields[0] ?? "";
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`;
}

export function poseComplete(pose: StudPose): boolean {
  return pose.x != null && pose.y != null && pose.layer != null && pose.rotation != null;
}
