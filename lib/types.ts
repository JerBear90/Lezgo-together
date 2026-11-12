export type Certainty = "certain" | "uncertain";

export type UncertainField = "color" | "shape" | "size" | "quantity";

export type PlacementUncertainField = "point" | "studs" | "orientation" | "layer";

/** A point inside the step crop, as fractions from 0 to 1. */
export type NormPoint = { x: number; y: number };

/** Stud counts read off the diagram. Null means the count was not made. */
export type StudOffset = {
  along: number | null;
  fromEdge: string | null;
  row: number | null;
  onto: string | null;
  relation: string | null;
};

/** One physical copy on the stud grid. Null axes were not located. */
export type StudPose = {
  x: number | null;
  y: number | null;
  layer: number | null;
  rotation: number | null;
};

export type PartPlacement = {
  point: NormPoint | null;
  callout: NormPoint | null;
  studs: StudOffset;
  poses: StudPose[];
  certainty: Certainty;
  uncertainFields: PlacementUncertainField[];
  note: string | null;
  needsRetake: boolean;
  corrected: boolean;
};

export type Region = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RetakeFlag = {
  needed: boolean;
  reasons: string[];
};

/** A part as read from a page, before it has a local id. */
export type PartSpec = {
  color: string;
  shape: string;
  size: string;
  quantity: number | null;
  certainty: Certainty;
  uncertainFields: UncertainField[];
  uncertaintyNote: string | null;
  placement: PartPlacement;
};

/** A step as read from a page, before it has a local id. */
export type StepSpec = {
  stepNumber: number;
  description: string;
  parts: PartSpec[];
  region: Region | null;
  placementCertainty: Certainty;
  placementNote: string | null;
};

export type ParsedExtraction = {
  pageSummary: string;
  retake: RetakeFlag;
  steps: StepSpec[];
};

export type Part = PartSpec & { id: string };

export type BuildStep = Omit<StepSpec, "parts"> & {
  id: string;
  pageId: string;
  parts: Part[];
};

export type PageStatus = "pending" | "reading" | "ready" | "retake" | "error";

export type InstructionPage = {
  id: string;
  order: number;
  imageDataUrl: string;
  fileName: string;
  status: PageStatus;
  error?: string;
  retake: RetakeFlag | null;
};

export type SetProgress = {
  currentStepId: string | null;
  checkedByStep: Record<string, string[]>;
};

export type BrickSet = {
  id: string;
  name: string;
  coverDataUrl: string | null;
  createdAt: number;
  updatedAt: number;
  pages: InstructionPage[];
  steps: BuildStep[];
  progress: SetProgress;
  sample: boolean;
};

export const UNCERTAIN_FIELDS: readonly UncertainField[] = [
  "color",
  "shape",
  "size",
  "quantity",
];

export const PLACEMENT_FIELDS: readonly PlacementUncertainField[] = [
  "point",
  "studs",
  "orientation",
  "layer",
];
