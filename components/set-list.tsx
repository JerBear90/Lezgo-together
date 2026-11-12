"use client";

import Link from "next/link";
import { attentionCounts } from "@/lib/labels";
import { buildDemoSet } from "@/lib/demo";
import { saveSet } from "@/lib/db";
import { orderedSteps } from "@/lib/editing";
import { stepIndex } from "@/lib/player";
import { BenchLoading, Mark } from "./ui";
import { useAiMode, useSetList } from "./use-set";

export function SetList() {
  const { sets, refresh, loading } = useSetList();
  const mode = useAiMode();

  async function loadSample() {
    await saveSet(buildDemoSet());
    await refresh();
  }

  return (
    <main className="px-4 pb-16 pt-6">
      <div className="flex items-center gap-3">
        <Mark size={36} />
        <div>
          <p className="font-display text-3xl leading-none">Lezgo</p>
          <p className="mt-1 text-sm text-muted">Clear steps for messy booklets.</p>
        </div>
      </div>
      {mode === "demo" ? (
        <p data-testid="demo-banner" className="mt-4 rounded-2xl bg-stud/40 px-3 py-2 text-sm">
          Demo mode is on. Readings are sample data until an AI Gateway key is set.
        </p>
      ) : null}
      <div className="mt-5 flex gap-2">
        <Link
          href="/sets/new"
          data-testid="create-set"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-brick px-4 font-semibold text-white"
        >
          New set
        </Link>
        <button
          type="button"
          data-testid="load-sample"
          onClick={() => void loadSample()}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-ink/15 bg-card px-4 font-semibold"
        >
          Try sample
        </button>
      </div>
      {loading || !sets ? (
        <BenchLoading label="Opening the bench" />
      ) : sets.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-dashed border-line bg-card px-4 py-8 text-center">
          <p className="font-display text-2xl">No sets on the bench yet.</p>
          <p className="mt-2 text-sm text-muted">
            Photograph the booklet, or open the Harbor Tug sample to try the builder.
          </p>
        </section>
      ) : (
        <ul className="mt-6 space-y-3">
          {sets.map((set) => {
            const steps = orderedSteps(set.pages, set.steps);
            const attention = attentionCounts(set);
            const progress = set.progress.currentStepId
              ? `Step ${stepIndex(steps, set.progress.currentStepId) + 1} of ${steps.length}`
              : steps.length > 0
                ? `${steps.length} steps ready`
                : "No steps yet";
            return (
              <li key={set.id}>
                <Link
                  href={`/sets/${set.id}`}
                  data-testid="set-card"
                  className="flex gap-3 rounded-3xl border border-line bg-card p-3 shadow-sm"
                >
                  {set.coverDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={set.coverDataUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-stud/50 font-display text-2xl">
                      {set.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-xl">{set.name}</span>
                    <span className="mt-1 block text-sm text-muted">{progress}</span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {attention.retakes > 0 ? (
                        <span className="rounded-full bg-[#fff1ec] px-2 py-0.5 text-xs font-semibold text-brick-dark">
                          {attention.retakes === 1
                            ? "1 photo needs a retake"
                            : `${attention.retakes} photos need a retake`}
                        </span>
                      ) : null}
                      {attention.unsureParts > 0 ? (
                        <span className="rounded-full bg-unsure-bg px-2 py-0.5 text-xs font-semibold text-unsure">
                          {attention.unsureParts} unsure part{attention.unsureParts === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
