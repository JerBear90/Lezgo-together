"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { orderedSteps } from "@/lib/editing";
import { placementLabel, retakeMessage, uncertaintyLabel } from "@/lib/labels";
import { quantityLabel } from "@/lib/parts";
import {
  allPartsChecked,
  applySwipe,
  checkedIds,
  goBack,
  goNext,
  jumpTo,
  progressFraction,
  stepIndex,
  togglePart,
} from "@/lib/player";
import { BenchLoading, ColorDot, ProgressBar, UnsureBadge } from "./ui";
import { useBrickSet } from "./use-set";
import { StepImage } from "./step-view";

export function StepPlayer({ id }: { id: string }) {
  const { set, loading, missing, commit, snapshot } = useBrickSet(id);
  const [jumpOpen, setJumpOpen] = useState(false);
  const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);

  const steps = set ? orderedSteps(set.pages, set.steps) : [];
  const index = set ? stepIndex(steps, set.progress.currentStepId) : 0;
  const step = steps[index];

  useEffect(() => {
    if (started.current) return;
    const current = snapshot();
    if (!current) return;
    const ordered = orderedSteps(current.pages, current.steps);
    if (ordered.length === 0) return;
    started.current = true;
    if (!current.progress.currentStepId) {
      commit({ ...current, progress: { ...current.progress, currentStepId: ordered[0].id } });
    }
  }, [set, commit, snapshot]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const current = snapshot();
      if (!current) return;
      const ordered = orderedSteps(current.pages, current.steps);
      if (event.key === "ArrowRight") {
        commit({ ...current, progress: goNext(ordered, current.progress) });
      }
      if (event.key === "ArrowLeft") {
        commit({ ...current, progress: goBack(ordered, current.progress) });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, snapshot]);

  if (loading) return <BenchLoading label="Opening the build" />;
  if (missing || !set) {
    return (
      <p className="px-4 py-8">
        That set is not on this device. <Link href="/">Back to sets</Link>
      </p>
    );
  }
  if (!step) {
    return (
      <main className="px-4 py-10 text-center">
        <p className="font-display text-2xl">No steps yet</p>
        <Link href={`/sets/${id}/pages`} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brick px-4 font-semibold text-white">
          Add pages
        </Link>
      </main>
    );
  }

  const page = set.pages.find((item) => item.id === step.pageId);
  const checked = checkedIds(set.progress, step.id);
  const place = placementLabel(step);
  const retake = page ? retakeMessage(page.retake) : null;
  const fraction = progressFraction(steps, step.id);

  function move(direction: "next" | "back") {
    const current = snapshot();
    if (!current) return;
    const ordered = orderedSteps(current.pages, current.steps);
    const progress = direction === "next" ? goNext(ordered, current.progress) : goBack(ordered, current.progress);
    commit({ ...current, progress });
    headingRef.current?.focus();
  }

  return (
    <div className="flex h-dvh flex-col" data-testid="step-player">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={`/sets/${id}`} className="text-sm font-semibold text-brick-dark">
          Set
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{set.name}</p>
        <p className="text-sm text-muted">
          {index + 1}/{steps.length}
        </p>
      </header>
      <div className="px-4">
        <ProgressBar value={fraction * steps.length} max={steps.length} label="Build progress" />
      </div>
      <div
        className="relative mt-3 min-h-48 flex-1"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        }}
        onPointerUp={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.current.x;
          const dy = event.clientY - drag.current.y;
          drag.current = null;
          const current = snapshot();
          if (!current) return;
          const ordered = orderedSteps(current.pages, current.steps);
          const progress = applySwipe(ordered, current.progress, dx, dy);
          if (progress.currentStepId !== current.progress.currentStepId) {
            commit({ ...current, progress });
          }
        }}
      >
        {page ? <StepImage src={page.imageDataUrl} region={step.region} alt={step.description} /> : null}
      </div>
      <section className="max-h-[50%] space-y-3 overflow-y-auto px-4 py-3">
        {retake ? (
          <p className="rounded-2xl bg-[#fff1ec] px-3 py-2 text-sm text-brick-dark">
            Retake this photo. {retake}{" "}
            <Link href={`/sets/${id}/pages`} className="font-semibold underline">
              Open pages
            </Link>
          </p>
        ) : null}
        {place ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-unsure">
            <UnsureBadge label={place} />
            <span>{place}</span>
          </p>
        ) : null}
        <h1 ref={headingRef} tabIndex={-1} data-testid="step-heading" className="font-display text-4xl outline-none">
          Step {step.stepNumber}
        </h1>
        <p>{step.description}</p>
        <ul className="space-y-2">
          {step.parts.length === 0 ? <li className="text-sm text-muted">No pieces listed for this step.</li> : null}
          {step.parts.map((part) => {
            const unsure = uncertaintyLabel(part);
            const on = checked.includes(part.id);
            return (
              <li key={part.id}>
                <button
                  type="button"
                  data-testid="part-check"
                  aria-pressed={on}
                  onClick={() => {
                    const current = snapshot();
                    if (!current) return;
                    commit({
                      ...current,
                      progress: togglePart(current.progress, step.id, part.id),
                    });
                  }}
                  className="flex w-full items-start gap-3 rounded-2xl border border-line bg-card px-3 py-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${on ? "border-pine bg-pine text-white" : "border-ink/20"}`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      <ColorDot color={part.color} />
                      {part.color} {part.shape} {part.size}
                      <span>{quantityLabel(part.quantity)}</span>
                      {unsure ? <UnsureBadge label={unsure} /> : null}
                    </span>
                    {unsure ? <span className="mt-1 block text-sm text-unsure">{unsure}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {allPartsChecked(step, checked) ? <p className="text-sm font-semibold text-pine">Pieces for this step are checked.</p> : null}
        <div className="flex gap-2 pb-2">
          <button
            type="button"
            data-testid="step-back"
            disabled={index === 0}
            onClick={() => move("back")}
            className="min-h-12 flex-1 rounded-full border border-ink/15 bg-card font-semibold disabled:opacity-40"
          >
            Back
          </button>
          {index === steps.length - 1 ? (
            <Link
              href={`/sets/${id}/parts`}
              data-testid="step-next"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-brick font-semibold text-white"
            >
              Parts
            </Link>
          ) : (
            <button
              type="button"
              data-testid="step-next"
              onClick={() => move("next")}
              className="min-h-12 flex-1 rounded-full bg-brick font-semibold text-white"
            >
              Next
            </button>
          )}
        </div>
        <button type="button" className="text-sm font-semibold text-muted" onClick={() => setJumpOpen((open) => !open)}>
          {jumpOpen ? "Close steps" : "Jump to step"}
        </button>
        {jumpOpen ? (
          <ol className="grid grid-cols-4 gap-2 pb-4">
            {steps.map((item, itemIndex) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    const current = snapshot();
                    if (!current) return;
                    commit({ ...current, progress: jumpTo(steps, current.progress, itemIndex) });
                    setJumpOpen(false);
                  }}
                  className={`min-h-11 w-full rounded-xl ${item.id === step.id ? "bg-ink text-paper" : "bg-card"}`}
                >
                  {item.stepNumber}
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}
