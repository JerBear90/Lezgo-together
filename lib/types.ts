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
  sections: ParsedSection[];
  combine: CombinePoint;
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
  /** Scroll position of the step sheet, saved as the builder moves. */
  sheetScrollTop: number;
  /** Scroll position of the zoomed step image. */
  imageScrollTop: number;
  /** 1 is the fitted crop. */
  zoom: number;
  updatedAt: number;
};

/** A sub-build such as the hull or the cabin. stepIds are local step ids. */
export type BuildSection = {
  id: string;
  name: string;
  stepIds: string[];
  assigneeId: string | null;
  certainty: Certainty;
  uncertaintyNote: string | null;
};

export type ParsedSection = {
  name: string;
  stepNumbers: number[];
  certainty: Certainty;
  uncertaintyNote: string | null;
};

/** Where separate sub-builds are meant to join. */
export type CombinePoint = {
  description: string;
  certainty: Certainty;
  uncertaintyNote: string | null;
};

/**
 * One builder on this device. No account. `updatedAt` is here so a later
 * sync can ship player records without rewriting page photos.
 */
export type PlayerProfile = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
};

export type BrickSet = {
  id: string;
  name: string;
  coverDataUrl: string | null;
  createdAt: number;
  updatedAt: number;
  pages: InstructionPage[];
  steps: BuildStep[];
  /**
   * Progress keyed by player id. Each entry is small enough to sync later
   * without the page images. This device does not sync it anywhere.
   */
  progressByPlayer: Record<string, SetProgress>;
  sections: BuildSection[];
  combine: CombinePoint;
  sample: boolean;
};

export const UNCERTAIN_FIELDS: readonly UncertainField[] = [
  "color",
  "shape",
  "size",
  "quantity",
];
