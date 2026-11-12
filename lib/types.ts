export type Certainty = "certain" | "uncertain";

export type UncertainField = "color" | "shape" | "size" | "quantity";

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
