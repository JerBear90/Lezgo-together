"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSet } from "@/lib/db";
import { buildDemoSet } from "@/lib/demo";
import { orderedSteps } from "@/lib/editing";
import { attentionCounts } from "@/lib/labels";
import { progressFraction, stepIndex } from "@/lib/player";
import { BenchLoading, ProgressBar, TopBar } from "./ui";
import { useBrickSet } from "./use-set";

export function SetHome({ id }: { id: string }) {
  const router = useRouter();
  const { set, loading, missing, commit } = useBrickSet(id);
  const [confirming, setConfirming] = useState(false);

  if (loading) return <BenchLoading label="Opening set" />;
  if (missing || !set) {
    return (
      <>
        <TopBar title="Missing set" backHref="/" backLabel="Sets" />
        <p className="px-4 py-8">That set is not on this device.</p>
      </>
    );
  }

  const steps = orderedSteps(set.pages, set.steps);
  const attention = attentionCounts(set);
  const index = stepIndex(steps, set.progress.currentStepId);
  const fraction = progressFraction(steps, set.progress.currentStepId);

  return (
    <>
      <TopBar title={set.name} backHref="/" backLabel="Sets" />
      <main className="space-y-4 px-4 py-5">
        {set.coverDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={set.coverDataUrl} alt="" className="h-44 w-full rounded-3xl object-cover" />
        ) : null}
        <p className="text-sm text-muted">
          {steps.length === 0
            ? "No steps yet"
            : set.progress.currentStepId
              ? `Step ${index + 1} of ${steps.length}`
              : `${steps.length} steps ready`}
        </p>
        {steps.length > 0 ? (
          <ProgressBar value={fraction * steps.length} max={steps.length} label="Build progress" />
        ) : null}
        {attention.retakes > 0 ? (
          <p className="rounded-2xl bg-[#fff1ec] px-3 py-2 text-sm font-semibold text-brick-dark">
            {attention.retakes} photo needs a retake
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/sets/${id}/pages`} data-testid="nav-pages" className="rounded-2xl bg-card px-3 py-4 text-center font-semibold shadow-sm">
            Pages
          </Link>
          <Link href={`/sets/${id}/steps`} data-testid="nav-steps" className="rounded-2xl bg-card px-3 py-4 text-center font-semibold shadow-sm">
            Fix steps
          </Link>
          <Link href={`/sets/${id}/parts`} data-testid="nav-parts" className="rounded-2xl bg-card px-3 py-4 text-center font-semibold shadow-sm">
            Parts
          </Link>
          <Link
            href={steps.length > 0 ? `/sets/${id}/play` : `/sets/${id}/pages`}
            data-testid="nav-play"
            className="rounded-2xl bg-brick px-3 py-4 text-center font-semibold text-white"
          >
            {set.progress.currentStepId ? "Continue" : "Build"}
          </Link>
        </div>
        {set.sample ? (
          <button
            type="button"
            className="text-sm font-semibold text-muted underline"
            onClick={() => commit(buildDemoSet())}
          >
            Reset sample build
          </button>
        ) : null}
        {confirming ? (
          <div className="rounded-2xl border border-line bg-card p-3">
            <p className="text-sm">Delete this set from this device?</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-full bg-brick px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  void deleteSet(id).then(() => router.push("/"));
                }}
              >
                Delete
              </button>
              <button type="button" className="rounded-full px-4 py-2 text-sm" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-sm text-brick-dark" onClick={() => setConfirming(true)}>
            Delete set
          </button>
        )}
      </main>
    </>
  );
}
