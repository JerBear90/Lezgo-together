import { applyPageExtraction, maxStepNumberBefore } from "./editing";
import { parseExtraction } from "./extraction";
import { createId } from "./ids";
import type { BrickSet } from "./types";

export async function requestPageRead(
  set: BrickSet,
  pageId: string,
): Promise<{ next: BrickSet; notice?: string; mode: "demo" | "live" }> {
  const page = set.pages.find((item) => item.id === pageId);
  if (!page) throw new Error("That page is missing.");
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: page.imageDataUrl,
      pageOrder: page.order,
      setName: set.name,
      previousMaxStep: maxStepNumberBefore(set, pageId),
    }),
  });
  const body = (await response.json()) as { error?: unknown; notice?: unknown; extraction?: unknown; mode?: unknown };
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Could not read that page.");
  }
  const extraction = parseExtraction(body.extraction);
  return {
    next: applyPageExtraction(set, pageId, extraction, createId),
    notice: typeof body.notice === "string" ? body.notice : undefined,
    mode: body.mode === "live" ? "live" : "demo",
  };
}
