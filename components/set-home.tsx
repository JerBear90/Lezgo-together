"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSet } from "@/lib/db";
import { buildDemoSet } from "@/lib/demo";
import { orderedSteps } from "@/lib/editing";
import { attentionCounts } from "@/lib/labels";
import { buildScene } from "@/lib/build-model";
import { layoutScene } from "@/lib/iso";
import { emptyProgress, progressFraction, resumeLabel, stepIndex } from "@/lib/player";
import { playableSteps, progressFor, savePlayerProgress, sectionSpans } from "@/lib/sections";
import { BenchLoading, ProgressBar, TopBar } from "./ui";
import { RoomSync } from "./room-sync";
import { ShareRoom } from "./share-room";
import { usePlayers } from "./use-players";
import { useBrickSet } from "./use-set";
import type { BuildStep } from "@/lib/types";

export function SetHome({ id }: { id: string }) {
  const router = useRouter();
  const { set, loading, missing, commit } = useBrickSet(id);
  const { active } = usePlayers();
  const [confirming, setConfirming] = useState(false);

  if (loading || !active) return <BenchLoading label="Opening set" />;
  if (missing || !set) {
    return (
      <>
        <TopBar title="Missing set" backHref="/" backLabel="Sets" />
        <p className="px-4 py-8">That set is not on this device.</p>
      </>
    );
  }

  const steps = orderedSteps(set.pages, set.steps);
  const mine = playableSteps(set, active.id);
  const progress = progressFor(set, active.id);
  const attention = attentionCounts(set);
  const index = stepIndex(mine, progress.currentStepId);
  const fraction = progressFraction(mine, progress.currentStepId);
  const resume = resumeLabel(mine, progress);

  return (
    <>
      <RoomSync setId={id} />
      <TopBar title={set.name} backHref="/" backLabel="Sets" />
      <main className="space-y-4 px-4 py-5">
        {resume ? (
          <div data-testid="resume-banner" className="rounded-3xl bg-ink px-4 py-3 text-paper">
            <p className="font-display text-2xl">{resume}</p>
            <button
              type="button"
              data-testid="start-over"
              className="mt-2 text-sm font-semibold text-stud"
              onClick={() => commit(savePlayerProgress(set, active.id, emptyProgress()))}
            >
              Start over
            </button>
          </div>
        ) : null}
        {set.coverDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={set.coverDataUrl} alt="" className="h-44 w-full rounded-3xl object-cover" />
        ) : null}
        <p className="text-sm text-muted">
          {steps.length === 0
            ? "No steps yet"
            : progress.currentStepId
              ? `Step ${index + 1} of ${mine.length}`
              : `${steps.length} steps ready`}
        </p>
        {mine.length > 0 ? (
          <ProgressBar value={fraction * mine.length} max={mine.length} label="Build progress" />
        ) : null}
        {attention.retakes > 0 ? (
          <p className="rounded-2xl bg-[#fff1ec] px-3 py-2 text-sm font-semibold text-brick-dark">
            {attention.retakes} photo needs a retake
          </p>
        ) : null}
        <GhostBuild steps={steps} />
        <ul className="grid grid-cols-3 gap-2">
          {sectionSpans(steps).map((section) => (
            <li key={section.id} className="rounded-2xl bg-card px-2 py-3 text-center shadow-sm">
              <p className="text-xs font-extrabold uppercase text-muted">{section.name}</p>
              <p className="font-display text-2xl">{section.to - section.from + 1}</p>
            </li>
          ))}
        </ul>
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
          <Link href={`/sets/${id}/together`} data-testid="nav-together" className="rounded-2xl bg-card px-3 py-4 text-center font-semibold shadow-sm">
            Together
          </Link>
          <Link
            href={steps.length > 0 ? `/sets/${id}/play` : `/sets/${id}/pages`}
            data-testid="nav-play"
            className="btn-sun col-span-2 px-3 py-4 text-center font-extrabold"
          >
            {progress.currentStepId ? "Continue" : "Build"}
          </Link>
        </div>
        <Link href="/" data-testid="done-build" className="btn-lip inline-flex min-h-12 items-center justify-center font-extrabold">
          Done
        </Link>
        <ShareRoom set={set} player={active} />
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

function GhostBuild({ steps }: { steps: BuildStep[] }) {
  if (steps.length === 0) return null;
  const last = steps[steps.length - 1];
  if (!last) return null;
  const layout = layoutScene(buildScene(steps, last.id));
  return (
    <div data-testid="ghost-model" className="h-44 overflow-hidden rounded-3xl bg-stage">
      <svg viewBox="0 0 100 100" className="h-full w-full opacity-50" aria-label="Ghost of the finished build">
        {layout.faces.map((face) => (
          <polygon key={face.key} points={face.points} fill={face.fill} stroke="#8aa4b5" strokeWidth={0.3} />
        ))}
      </svg>
    </div>
  );
}
