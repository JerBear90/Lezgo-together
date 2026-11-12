"use client";

import Link from "next/link";
import { orderedSteps } from "@/lib/editing";
import { uncertaintyLabel } from "@/lib/labels";
import { quantityLabel, rollupParts } from "@/lib/parts";
import { sectionSpans } from "@/lib/sections";
import { MissingSet } from "./missing-set";
import { BenchLoading, ColorDot, TopBar, UnsureBadge } from "./ui";
import { useBrickSet } from "./use-set";

export function PartsView({ id }: { id: string }) {
  const { set, loading, missing } = useBrickSet(id);
  if (loading) return <BenchLoading label="Counting pieces" />;
  if (missing || !set) return <MissingSet />;
  const steps = orderedSteps(set.pages, set.steps);
  const parts = rollupParts(steps);
  return (
    <>
      <TopBar
        title="Parts"
        backHref={`/sets/${id}`}
        backLabel="Set"
        extra={
          <Link href={`/sets/${id}/play`} className="text-sm font-semibold text-brick-dark">
            Build
          </Link>
        }
      />
      <main className="px-4 py-4">
        <p className="text-sm text-muted">Pieces called out across the steps. Unsure rows were not guessed.</p>
        {parts.length === 0 ? (
          <p className="mt-6 text-sm">No pieces yet. Read a page or add a step.</p>
        ) : (
          <ul data-testid="parts-list" className="mt-4 space-y-4">
            {sectionSpans(steps).map((section) => (
              <li key={section.id}>
                <h2 className="text-sm font-extrabold uppercase text-muted">{section.name}</h2>
                <ul className="mt-2 space-y-2">
                  {rollupParts(steps.slice(section.from, section.to + 1)).map((part) => {
              const label =
                part.certainty === "uncertain"
                  ? uncertaintyLabel({
                      certainty: "uncertain",
                      uncertainFields: part.uncertainFields,
                      uncertaintyNote: part.uncertaintyNotes[0] ?? null,
                    })
                  : null;
              return (
                <li key={part.key} className="rounded-2xl border border-line bg-card px-3 py-3">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <ColorDot color={part.color} />
                    <span>
                      {part.color} {part.shape} {part.size}
                    </span>
                    <span>{quantityLabel(part.quantity)}</span>
                    {label ? <UnsureBadge label={label} /> : null}
                  </p>
                  {label ? <p className="mt-1 text-sm text-unsure">{label}</p> : null}
                  <p className="mt-1 text-xs text-muted">Steps {part.stepNumbers.join(", ")}</p>
                </li>
                  );
                })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
