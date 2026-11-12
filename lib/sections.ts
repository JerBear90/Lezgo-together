export type SectionSpan = {
  id: string;
  name: string;
  from: number;
  to: number;
};

/** Groups steps the way a booklet splits bags. The sample set uses Hull, Cabin, and Finish. */
export function sectionSpans(steps: { id: string }[]): SectionSpan[] {
  if (steps.length === 0) return [];
  const sample = steps.every((step) => step.id.startsWith("demo-step-"));
  if (sample) {
    return [
      { id: "hull", name: "Hull", from: 0, to: Math.min(1, steps.length - 1) },
      { id: "cabin", name: "Cabin", from: 2, to: Math.min(5, steps.length - 1) },
      { id: "finish", name: "Finish", from: 6, to: steps.length - 1 },
    ].filter((section) => section.from < steps.length && section.from <= section.to);
  }
  return [{ id: "build", name: "Build", from: 0, to: steps.length - 1 }];
}

export function sectionAt(sections: SectionSpan[], index: number): SectionSpan | null {
  return sections.find((section) => index >= section.from && index <= section.to) ?? null;
}
