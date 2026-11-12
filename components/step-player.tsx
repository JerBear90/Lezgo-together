"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { lookupPart } from "@/lib/catalog";
import { updatePartPlacement } from "@/lib/editing";
import { placementLabel, retakeMessage, uncertaintyLabel } from "@/lib/labels";
import { canDrawPhotoArrow, formatStudPlacement, nudgeStud, placementUncertaintyLabel, shiftPose } from "@/lib/placement";
import { brickPaint, quantityLabel } from "@/lib/parts";
import {
  applySwipe,
  checkedIds,
  goBack,
  goNext,
  jumpTo,
  stepIndex,
  togglePart,
} from "@/lib/player";
import { playableSteps, progressFor, savePlayerProgress, sectionAt, sectionSpans } from "@/lib/sections";
import { MissingSet } from "./missing-set";
import { BenchLoading, UnsureBadge } from "./ui";
import { RoomSync } from "./room-sync";
import { usePlayers } from "./use-players";
import { useBrickSet } from "./use-set";
import { StepDiagram } from "./step-diagram";
import { StepImage } from "./step-view";
import type { Part } from "@/lib/types";

export function StepPlayer({ id }: { id: string }) {
  const { set, loading, missing, commit, snapshot } = useBrickSet(id);
  const { active } = usePlayers();
  const [view, setView] = useState<"diagram" | "photo">("diagram");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [bagDismissed, setBagDismissed] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);

  const progress = set && active ? progressFor(set, active.id) : null;
  const steps = set && active ? playableSteps(set, active.id) : [];
  const index = progress ? stepIndex(steps, progress.currentStepId) : 0;
  const shown = preview ?? index;
  const step = steps[index];
  const shownStep = steps[shown] ?? step;

  useEffect(() => {
    if (started.current) return;
    const current = snapshot();
    if (!current || !active) return;
    started.current = true;
    const mine = progressFor(current, active.id);
    const visible = playableSteps(current, active.id);
    if (visible.length === 0) return;
    const nextId = visible.some((item) => item.id === mine.currentStepId) ? mine.currentStepId : visible[0].id;
    if (mine.currentStepId !== nextId) {
      commit(savePlayerProgress(current, active.id, { ...mine, currentStepId: nextId }));
    }
  }, [set, active, commit, snapshot]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const current = snapshot();
      if (!current) return;
      if (!active) return;
      const ordered = playableSteps(current, active.id);
      const mine = progressFor(current, active.id);
      if (event.key === "ArrowRight") {
        setPreview(null);
        commit(savePlayerProgress(current, active.id, goNext(ordered, mine)));
      }
      if (event.key === "ArrowLeft") {
        setPreview(null);
        commit(savePlayerProgress(current, active.id, goBack(ordered, mine)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, commit, snapshot]);

  if (loading || !active) return <BenchLoading label="Opening the build" />;
  const player = active;
  if (missing || !set) return <MissingSet />;
  if (!progress || !step || !shownStep) {
    return (
      <main className="px-4 py-10 text-center">
        <p className="font-display text-2xl">No steps yet</p>
        <Link href={`/sets/${id}/pages`} className="btn-sun mt-4 inline-flex min-h-12 items-center px-4 font-extrabold">
          Add pages
        </Link>
      </main>
    );
  }

  const sections = sectionSpans(steps);
  const section = sectionAt(sections, shown);
  const page = set.pages.find((item) => item.id === shownStep.pageId);
  const checked = checkedIds(progress, step.id);
  const place = placementLabel(shownStep);
  const retake = page ? retakeMessage(page.retake) : null;
  const placementRetake = shownStep.parts.some((part) => part.placement.needsRetake);
  const atSectionStart = section != null && shown === section.from && shown > 0 && bagDismissed !== section.id;

  function playingStep(current: NonNullable<ReturnType<typeof snapshot>>) {
    const ordered = playableSteps(current, player.id);
    return ordered[stepIndex(ordered, progressFor(current, player.id).currentStepId)];
  }

  function shift(partId: string, poseIndex: number, axis: "x" | "y", delta: number) {
    const current = snapshot();
    if (!current) return;
    const playing = playingStep(current);
    const part = playing?.parts.find((item) => item.id === partId);
    if (!playing || !part) return;
    commit(updatePartPlacement(current, playing.id, partId, shiftPose(part.placement, poseIndex, axis, delta)));
  }

  function nudge(partId: string, axis: "along" | "row", delta: number) {
    const current = snapshot();
    if (!current) return;
    const playing = playingStep(current);
    const part = playing?.parts.find((item) => item.id === partId);
    if (!playing || !part) return;
    commit(updatePartPlacement(current, playing.id, partId, nudgeStud(part.placement, axis, delta)));
  }

  function move(direction: "next" | "back") {
    const current = snapshot();
    if (!current) return;
    setPreview(null);
    const ordered = playableSteps(current, player.id);
    const mine = progressFor(current, player.id);
    const next = direction === "next" ? goNext(ordered, mine) : goBack(ordered, mine);
    commit(savePlayerProgress(current, player.id, next));
    headingRef.current?.focus();
  }

  function confirmJump() {
    if (preview == null) return;
    const current = snapshot();
    if (!current) return;
    const ordered = playableSteps(current, player.id);
    commit(savePlayerProgress(current, player.id, jumpTo(ordered, progressFor(current, player.id), preview)));
    setPreview(null);
  }

  return (
    <div className="stage-screen" data-testid="step-player">
      <RoomSync setId={id} />
      <aside className="stage-parts" aria-label="Parts for this step">
        {shownStep.parts.length === 0 ? <p className="text-xs font-bold text-ink/70">No pieces</p> : null}
        {shownStep.parts.map((part) => {
          const on = checked.includes(part.id);
          const unsure = uncertaintyLabel(part);
          const placeUnsure = placementUncertaintyLabel(part);
          return (
            <div key={part.id} className={`part-tile ${part.placement.certainty === "uncertain" ? "part-tile-ghost" : ""}`}>
              <PartGlyph color={part.color} />
              <span className="part-count">{quantityLabel(part.quantity).replace("×", "")}×</span>
              <button
                type="button"
                data-testid="part-check"
                aria-pressed={on}
                onClick={() => {
                  const current = snapshot();
                  if (!current) return;
                  commit(savePlayerProgress(current, player.id, togglePart(progressFor(current, player.id), step.id, part.id)));
                }}
                className={`part-check ${on ? "part-check-on" : ""}`}
              >
                {on ? "✓" : ""}
              </button>
              {unsure || placeUnsure ? <UnsureBadge label={unsure ?? placeUnsure ?? "Unsure"} /> : null}
              {unsure ? <span className="sr-only text-unsure">{unsure}</span> : null}
            </div>
          );
        })}
      </aside>
      <div
        className="stage-main"
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
          const ordered = playableSteps(current, player.id);
          const mine = progressFor(current, player.id);
          const next = applySwipe(ordered, mine, dx, dy);
          if (next.currentStepId !== mine.currentStepId) {
            setPreview(null);
            commit(savePlayerProgress(current, player.id, next));
          }
        }}
      >
        <div className="stage-top">
          <p data-testid="section-chip" className="section-chip">
            {section?.name ?? "Build"}
          </p>
          <h1 ref={headingRef} tabIndex={-1} data-testid="step-heading" className="stage-step">
            {preview != null && preview !== index ? `Preview ${shownStep.stepNumber}` : `Step ${step.stepNumber}`}
          </h1>
          {view === "diagram" ? (
            <button type="button" data-testid="show-photo" className="btn-lip shrink-0 px-3 text-sm font-extrabold" onClick={() => setView("photo")}>
              Photo
            </button>
          ) : (
            <button type="button" data-testid="show-diagram" className="btn-lip shrink-0 px-3 text-sm font-extrabold" onClick={() => setView("diagram")}>
              Diagram
            </button>
          )}
          <Link href={`/sets/${id}`} className="close-x" aria-label="Close">
            ×
          </Link>
        </div>
        <div key={shownStep.id} className="stage-view stage-ease">
          {view === "diagram" ? (
            <StepDiagram steps={steps} stepId={shownStep.id} onShift={shift} onSelect={setSelectedPartId} />
          ) : page ? (
            <StepImage fill src={page.imageDataUrl} region={shownStep.region} alt={shownStep.description}>
              <PhotoArrows parts={shownStep.parts} />
            </StepImage>
          ) : null}
        </div>
        <div className="stage-caption">
          {shownStep.parts.map((part) => {
            const studs = formatStudPlacement(part);
            const catalog = lookupPart(part.shape, part.size);
            const identified = catalog && part.certainty === "certain" && part.placement.certainty === "certain";
            return (
              <div key={part.id}>
                {studs ? <p data-testid="stud-text">{studs}</p> : null}
                {identified ? (
                  <p data-testid="part-id">
                    {catalog.id} · {catalog.name}
                  </p>
                ) : null}
                {selectedPartId === part.id ? (
                  <div className="mt-1 flex gap-2">
                    <Nudge label="Studs" testId="stud-along" onChange={(delta) => nudge(part.id, "along", delta)} />
                    <Nudge label="Row" testId="stud-row" onChange={(delta) => nudge(part.id, "row", delta)} />
                  </div>
                ) : null}
              </div>
            );
          })}
          {place ? <p className="text-unsure">{place}</p> : null}
          {retake ? <p className="stage-note">Retake this photo. {retake}</p> : null}
          {placementRetake && !retake ? (
            <p data-testid="placement-retake" className="stage-note">
              Retake this photo. A straighter, closer shot would show the studs.
            </p>
          ) : null}
          {preview != null && preview !== index ? (
            <button type="button" data-testid="confirm-jump" className="btn-sun mt-2 px-3 py-2 text-sm font-extrabold" onClick={confirmJump}>
              Go to step {steps[preview]?.stepNumber}
            </button>
          ) : null}
          {atSectionStart && section ? (
            <p data-testid="bag-open" className="stage-note">
              Open the next bag · {section.name}, {section.to - section.from + 1} steps.{" "}
              <button type="button" className="font-extrabold underline" onClick={() => setBagDismissed(section.id)}>
                Start
              </button>
              <button
                type="button"
                data-testid="skip-section"
                className="ml-3 font-extrabold underline"
                onClick={() => {
                  setPreview(Math.min(section.to + 1, steps.length - 1));
                }}
              >
                Skip
              </button>
            </p>
          ) : null}
          {section && shown === section.to && section.to < steps.length - 1 ? (
            <p data-testid="section-done" className="stage-note">
              Done all {section.to - section.from + 1}.{" "}
              <button type="button" className="font-extrabold underline" onClick={() => setPreview(section.to + 1)}>
                Skip
              </button>
            </p>
          ) : null}
        </div>
        <button type="button" data-testid="step-back" className="btn-lip stage-back" disabled={index === 0} onClick={() => move("back")}>
          Back
        </button>
        {index === steps.length - 1 ? (
          <Link href={`/sets/${id}`} data-testid="step-next" className="btn-lip stage-next">
            Next
          </Link>
        ) : (
          <button type="button" data-testid="step-next" className="btn-lip stage-next" onClick={() => move("next")}>
            Next
          </button>
        )}
        <div className="stage-slider">
          <div className="mb-1 flex gap-1 overflow-x-auto">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`section-chip ${section?.id === item.id ? "section-chip-on" : ""}`}
                onClick={() => setPreview(item.from === index ? null : item.from)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <label className="stud-slider">
            <span className="sr-only">Build progress</span>
            <input
              data-testid="step-slider"
              type="range"
              min={0}
              max={Math.max(steps.length - 1, 0)}
              value={shown}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPreview(next === index ? null : next);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function PartGlyph({ color }: { color: string }) {
  const paint = brickPaint(color);
  const stud = paint.dark ? { background: paint.stud } : undefined;
  return (
    <span
      className="part-glyph"
      data-dark={paint.dark ? "true" : undefined}
      style={{ background: paint.fill, boxShadow: paint.dark ? `inset 0 0 0 1.5px ${paint.edge}` : undefined }}
      aria-hidden="true"
    >
      <i style={stud} /><i style={stud} /><i style={stud} /><i style={stud} />
    </span>
  );
}

function PhotoArrows({ parts }: { parts: Part[] }) {
  const marks = parts.filter((part) => canDrawPhotoArrow(part) && part.placement.point && part.placement.callout);
  if (marks.length === 0) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {marks.map((part) => {
        const from = part.placement.callout;
        const to = part.placement.point;
        if (!from || !to) return null;
        return (
          <g key={part.id} data-testid="photo-arrow">
            <line x1={from.x * 100} y1={from.y * 100} x2={to.x * 100} y2={to.y * 100} stroke="#e23d2b" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            <circle cx={to.x * 100} cy={to.y * 100} r="2.2" fill="none" stroke="#f0c445" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}

function Nudge({ label, testId, onChange }: { label: string; testId: string; onChange: (delta: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-extrabold">
      {label}
      <button type="button" data-testid={`${testId}-dec`} className="h-8 w-8 rounded-full bg-stage" onClick={() => onChange(-1)} aria-label={`Decrease ${label}`}>
        −
      </button>
      <button type="button" data-testid={`${testId}-inc`} className="h-8 w-8 rounded-full bg-stage" onClick={() => onChange(1)} aria-label={`Increase ${label}`}>
        +
      </button>
    </span>
  );
}
