"use client";

import { orderedSteps, addBlankStep, addPart, deleteStep, markPartClear, markPartUnsure, mergeSteps, removePart, setPlacement, splitStep, updatePart, updateStep } from "@/lib/editing";
import { canMarkPartCertain, placementLabel, uncertaintyLabel } from "@/lib/labels";
import { createId } from "@/lib/ids";
import type { BrickSet, BuildStep, Part } from "@/lib/types";
import { BenchLoading, TopBar, UnsureBadge } from "./ui";
import { useBrickSet } from "./use-set";

export function StepEditor({ id }: { id: string }) {
  const { set, loading, missing, commit, snapshot } = useBrickSet(id);
  if (loading) return <BenchLoading label="Opening steps" />;
  if (missing || !set) {
    return (
      <>
        <TopBar title="Steps" backHref="/" backLabel="Sets" />
        <p className="px-4 py-8">That set is not on this device.</p>
      </>
    );
  }
  const steps = orderedSteps(set.pages, set.steps);
  const pages = [...set.pages].sort((a, b) => a.order - b.order);

  function change(next: BrickSet) {
    const current = snapshot();
    if (!current) return;
    commit(next);
  }

  return (
    <>
      <TopBar title="Fix steps" backHref={`/sets/${id}`} backLabel="Set" />
      <main className="space-y-4 px-4 py-4">
        <p className="text-sm text-muted">
          Correct anything the reader got wrong. Unsure pieces stay marked until you fill them in and mark them clear.
        </p>
        {pages.length > 0 ? (
          <button
            type="button"
            className="min-h-11 rounded-full border border-ink/15 bg-card px-4 font-semibold"
            onClick={() => change(addBlankStep(snapshot() ?? set, pages[0].id, createId()))}
          >
            Add step
          </button>
        ) : (
          <p className="text-sm">Add instruction pages before creating steps.</p>
        )}
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            total={steps.length}
            onChange={change}
            current={() => snapshot() ?? set}
          />
        ))}
      </main>
    </>
  );
}

function StepCard({
  step,
  index,
  total,
  onChange,
  current,
}: {
  step: BuildStep;
  index: number;
  total: number;
  onChange: (next: BrickSet) => void;
  current: () => BrickSet;
}) {
  const place = placementLabel(step);
  return (
    <article className="space-y-3 rounded-3xl border border-line bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-2xl">Step {step.stepNumber}</h2>
        {place ? <UnsureBadge label={place} /> : null}
      </div>
      <label className="block text-sm">
        Step number
        <input
          type="number"
          min={1}
          value={step.stepNumber}
          className="mt-1 w-24 rounded-xl border border-line px-2 py-2"
          onChange={(event) => {
            const stepNumber = Number(event.target.value);
            if (!Number.isFinite(stepNumber) || stepNumber <= 0) return;
            onChange(updateStep(current(), step.id, { stepNumber: Math.round(stepNumber) }));
          }}
        />
      </label>
      <label className="block text-sm">
        Instruction
        <textarea
          value={step.description}
          rows={3}
          className="mt-1 w-full rounded-xl border border-line px-2 py-2"
          onChange={(event) => onChange(updateStep(current(), step.id, { description: event.target.value }))}
        />
      </label>
      {place ? <p className="text-sm text-unsure">{place}</p> : null}
      <label className="block text-sm">
        Placement note
        <input
          value={step.placementNote ?? ""}
          className="mt-1 w-full rounded-xl border border-line px-2 py-2"
          onChange={(event) =>
            onChange(
              setPlacement(
                current(),
                step.id,
                event.target.value.trim() ? "uncertain" : step.placementCertainty,
                event.target.value,
              ),
            )
          }
        />
      </label>
      <button
        type="button"
        className="text-sm font-semibold"
        onClick={() =>
          onChange(
            setPlacement(
              current(),
              step.id,
              step.placementCertainty === "uncertain" ? "certain" : "uncertain",
              step.placementNote,
            ),
          )
        }
      >
        {step.placementCertainty === "uncertain" ? "Mark placement clear" : "Flag placement unsure"}
      </button>
      <ul className="space-y-3">
        {step.parts.map((part) => (
          <PartEditor key={part.id} part={part} stepId={step.id} onChange={onChange} current={current} />
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-full border border-line px-3 py-2 text-sm" onClick={() => onChange(addPart(current(), step.id, createId()))}>
          Add part
        </button>
        <button
          type="button"
          className="rounded-full border border-line px-3 py-2 text-sm disabled:opacity-40"
          disabled={index >= total - 1}
          onClick={() => onChange(mergeSteps(current(), index))}
        >
          Merge with next
        </button>
        <button type="button" className="rounded-full border border-line px-3 py-2 text-sm" onClick={() => onChange(splitStep(current(), index, createId()))}>
          Split step
        </button>
        <button type="button" className="rounded-full px-3 py-2 text-sm text-brick-dark" onClick={() => onChange(deleteStep(current(), step.id))}>
          Delete step
        </button>
      </div>
    </article>
  );
}

function PartEditor({
  part,
  stepId,
  onChange,
  current,
}: {
  part: Part;
  stepId: string;
  onChange: (next: BrickSet) => void;
  current: () => BrickSet;
}) {
  const label = uncertaintyLabel(part);
  const clearable = canMarkPartCertain(part);
  return (
    <li className="rounded-2xl bg-paper p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        {label ? <UnsureBadge label={label} /> : <span className="text-xs font-semibold text-pine">Clear</span>}
        <button type="button" className="text-xs text-brick-dark" onClick={() => onChange(removePart(current(), stepId, part.id))}>
          Remove
        </button>
      </div>
      {label ? <p className="mb-2 text-xs text-unsure">{label}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Color" value={part.color} onChange={(color) => onChange(updatePart(current(), stepId, part.id, { color }))} />
        <Field label="Shape" value={part.shape} onChange={(shape) => onChange(updatePart(current(), stepId, part.id, { shape }))} />
        <Field label="Size" value={part.size} onChange={(size) => onChange(updatePart(current(), stepId, part.id, { size }))} />
        <label className="text-xs">
          Quantity
          <input
            value={part.quantity ?? ""}
            inputMode="numeric"
            className="mt-1 w-full rounded-xl border border-line px-2 py-2"
            onChange={(event) => {
              const raw = event.target.value.trim();
              const quantity = raw === "" ? null : Number(raw);
              onChange(
                updatePart(current(), stepId, part.id, {
                  quantity: quantity != null && Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : null,
                }),
              );
            }}
          />
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!clearable || part.certainty === "certain"}
          className="rounded-full bg-pine px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
          onClick={() => onChange(markPartClear(current(), stepId, part.id))}
        >
          Mark clear
        </button>
        <button
          type="button"
          className="rounded-full bg-unsure-bg px-3 py-1 text-xs font-semibold text-unsure"
          onClick={() => onChange(markPartUnsure(current(), stepId, part.id, part.uncertaintyNote ?? ""))}
        >
          Flag unsure
        </button>
      </div>
    </li>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs">
      {label}
      <input value={value} className="mt-1 w-full rounded-xl border border-line px-2 py-2" onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
