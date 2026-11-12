"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { placementLabel, retakeMessage, uncertaintyLabel } from "@/lib/labels";
import { quantityLabel } from "@/lib/parts";
import {
  allPartsChecked,
  applySwipe,
  checkedIds,
  emptyProgress,
  goBack,
  goNext,
  jumpTo,
  progressFraction,
  stepIndex,
  togglePart,
} from "@/lib/player";
import { isCombineStep, playableSteps, progressFor, savePlayerProgress } from "@/lib/sections";
import { BenchLoading, ColorDot, ProgressBar, UnsureBadge } from "./ui";
import { RoomSync } from "./room-sync";
import { usePlayers } from "./use-players";
import { useBrickSet } from "./use-set";
import { StepImage } from "./step-view";

export function StepPlayer({ id }: { id: string }) {
  const { set, loading, missing, commit, snapshot } = useBrickSet(id);
  const { active } = usePlayers();
  const [jumpOpen, setJumpOpen] = useState(false);
  const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const started = useRef<string | null>(null);

  const progress = set && active ? progressFor(set, active.id) : emptyProgress();
  const steps = set && active ? playableSteps(set, active.id) : [];
  const index = stepIndex(steps, progress.currentStepId);
  const step = steps[index];

  function writeProgress(nextProgress: typeof progress) {
    const current = snapshot();
    if (!current || !active) return;
    void commit(savePlayerProgress(current, active.id, nextProgress));
  }

  useEffect(() => {
    if (!active) return;
    if (started.current === active.id) return;
    const current = snapshot();
    if (!current) return;
    const ordered = playableSteps(current, active.id);
    if (ordered.length === 0) return;
    const mine = progressFor(current, active.id);
    const visible = ordered.some((item) => item.id === mine.currentStepId) ? mine.currentStepId : ordered[0].id;
    if (mine.currentStepId !== visible) {
      writeProgress({ ...mine, currentStepId: visible });
    }
    if (started.current === active.id) return;
    started.current = active.id;
    // Restore scroll and zoom once this player's build opens.
    requestAnimationFrame(() => {
      if (sheetRef.current) sheetRef.current.scrollTop = mine.sheetScrollTop;
      if (imageRef.current) imageRef.current.scrollTop = mine.imageScrollTop;
    });
    // writeProgress closes over the latest snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, active, commit, snapshot]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const current = snapshot();
      if (!current || !active) return;
      const ordered = playableSteps(current, active.id);
      const mine = progressFor(current, active.id);
      if (event.key === "ArrowRight") writeProgress(goNext(ordered, mine));
      if (event.key === "ArrowLeft") writeProgress(goBack(ordered, mine));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, snapshot, active]);

  if (loading || !active) return <BenchLoading label="Opening the build" />;
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
  const checked = checkedIds(progress, step.id);
  const place = placementLabel(step);
  const retake = page ? retakeMessage(page.retake) : null;
  const fraction = progressFraction(steps, step.id);

  function move(direction: "next" | "back") {
    const current = snapshot();
    if (!current || !active) return;
    const ordered = playableSteps(current, active.id);
    const mine = progressFor(current, active.id);
    writeProgress(direction === "next" ? goNext(ordered, mine) : goBack(ordered, mine));
    headingRef.current?.focus();
  }

  return (
    <div className="flex h-full flex-col" data-testid="step-player" data-zoom={progress.zoom}>
      <RoomSync setId={id} />
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
        ref={imageRef}
        className="relative mt-3 min-h-48 flex-1 overflow-auto"
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        }}
        onPointerUp={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.current.x;
          const dy = event.clientY - drag.current.y;
          drag.current = null;
          const current = snapshot();
          if (!current || !active) return;
          const ordered = playableSteps(current, active.id);
          const mine = progressFor(current, active.id);
          const next = applySwipe(ordered, mine, dx, dy);
          if (next.currentStepId !== mine.currentStepId) writeProgress(next);
        }}
        onScroll={() => {
          const current = snapshot();
          if (!current || !active || !imageRef.current) return;
          const mine = progressFor(current, active.id);
          writeProgress({ ...mine, imageScrollTop: imageRef.current.scrollTop });
        }}
      >
        <div style={{ transform: `scale(${progress.zoom})`, transformOrigin: "top center" }}>
          {page ? <StepImage src={page.imageDataUrl} region={step.region} alt={step.description} /> : null}
          {isCombineStep(step) && set.coverDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={set.coverDataUrl} alt="" className="mx-auto max-h-64 object-contain" />
          ) : null}
        </div>
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button
            type="button"
            data-testid="zoom-out"
            className="h-9 w-9 rounded-full bg-card font-semibold"
            onClick={() => writeProgress({ ...progress, zoom: Math.max(1, progress.zoom - 0.5) })}
          >
            −
          </button>
          <button
            type="button"
            data-testid="zoom-in"
            className="h-9 w-9 rounded-full bg-card font-semibold"
            onClick={() => writeProgress({ ...progress, zoom: Math.min(2.5, progress.zoom + 0.5) })}
          >
            +
          </button>
        </div>
      </div>
      <section
        ref={sheetRef}
        className="max-h-[50%] space-y-3 overflow-y-auto px-4 py-3"
        onScroll={() => {
          const current = snapshot();
          if (!current || !active || !sheetRef.current) return;
          const mine = progressFor(current, active.id);
          writeProgress({ ...mine, sheetScrollTop: sheetRef.current.scrollTop });
        }}
      >
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
          {isCombineStep(step) ? "Combine" : `Step ${step.stepNumber}`}
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
                    if (!current || !active) return;
                    writeProgress(togglePart(progressFor(current, active.id), step.id, part.id));
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
                    if (!current || !active) return;
                    writeProgress(jumpTo(steps, progressFor(current, active.id), itemIndex));
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
