"use client";

import { orderedSteps } from "@/lib/editing";
import { uncertaintyLabel } from "@/lib/labels";
import { playerStatusLabel } from "@/lib/player";
import { assignSection, playableSteps, progressFor, splitOffSection } from "@/lib/sections";
import { BenchLoading, TopBar, UnsureBadge } from "./ui";
import { usePlayers } from "./use-players";
import { useBrickSet } from "./use-set";
import { RoomSync } from "./room-sync";
import { ShareRoom } from "./share-room";
import { createId } from "@/lib/ids";
import { useEffect, useState } from "react";
import { readMembership } from "@/lib/rooms/membership";
import type { RoomPlayer } from "@/lib/rooms/model";

export function TogetherView({ id }: { id: string }) {
  const { set, loading, missing, commit, snapshot } = useBrickSet(id);
  const { players, active } = usePlayers();
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [splitName, setSplitName] = useState("Cabin");
  const [splitStep, setSplitStep] = useState("");

  useEffect(() => {
    let stop = false;
    async function load() {
      const membership = readMembership();
      if (!membership || membership.setId !== id) return;
      const response = await fetch(`/api/rooms/${membership.code}`);
      if (!response.ok || stop) return;
      const body = (await response.json()) as { room?: { players: RoomPlayer[] } };
      if (body.room) setRoomPlayers(body.room.players);
    }
    void load();
    const timer = window.setInterval(() => void load(), 1500);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [id]);

  const roster = roomPlayers.length > 0 ? roomPlayers : players.map((player) => ({ ...player, lastSeenAt: 0 }));

  if (loading) return <BenchLoading label="Opening the room" />;
  if (missing || !set || !active) {
    return (
      <>
        <TopBar title="Together" backHref="/" backLabel="Sets" />
        <p className="px-4 py-8">That set is not on this device yet.</p>
      </>
    );
  }

  const steps = orderedSteps(set.pages, set.steps);
  const placeNote = set.combine.certainty === "uncertain" ? set.combine.uncertaintyNote : null;

  return (
    <>
      <RoomSync setId={id} />
      <TopBar title="Together" backHref={`/sets/${id}`} backLabel="Set" />
      <main className="space-y-4 px-4 py-4">
        <ShareRoom set={set} player={active} />
        <section className="rounded-3xl border border-line bg-card p-4">
          <h2 className="font-display text-2xl">Who is where</h2>
          <ul className="mt-2 space-y-2" data-testid="shared-progress">
            {roster.map((player) => {
              const progress = progressFor(set, player.id);
              const theirs = playableSteps(set, player.id);
              return (
                <li key={player.id} data-testid="player-progress" className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="h-4 w-4 rounded-full" style={{ background: player.color }} />
                  <span>{playerStatusLabel(player.name, theirs, progress)}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Sections</h2>
          {set.sections.length === 0 ? (
            <p className="text-sm text-muted">No sub-builds yet. Split the steps by hand, or read a page that shows them.</p>
          ) : null}
          {set.sections.map((section) => {
            const label =
              section.certainty === "uncertain"
                ? uncertaintyLabel({
                    certainty: "uncertain",
                    uncertainFields: [],
                    uncertaintyNote: section.uncertaintyNote,
                  })
                : null;
            return (
              <article key={section.id} data-testid="section-card" className="rounded-3xl border border-line bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{section.name}</h3>
                  {section.certainty === "uncertain" ? (
                    <UnsureBadge label={section.uncertaintyNote ?? "Unsure where this section ends."} />
                  ) : null}
                </div>
                {label ? <p className="mt-1 text-sm text-unsure">{section.uncertaintyNote}</p> : null}
                <p className="mt-1 text-xs text-muted">{section.stepIds.length} steps</p>
                <label className="mt-2 block text-sm">
                  Assign {section.name}
                  <select
                    aria-label={`Assign ${section.name}`}
                    className="mt-1 w-full rounded-xl border border-line bg-paper px-2 py-2"
                    value={section.assigneeId ?? ""}
                    onChange={(event) => {
                      const current = snapshot();
                      if (!current) return;
                      commit(assignSection(current, section.id, event.target.value || null));
                    }}
                  >
                    <option value="">Nobody yet</option>
                    {roster.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            );
          })}
        </section>
        <section className="rounded-3xl border border-line bg-card p-4">
          <h2 className="font-display text-2xl">Combine</h2>
          {set.combine.certainty === "uncertain" ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-unsure">
              <UnsureBadge label={placeNote ?? "Unsure where the sub-builds join."} />
              <span>{set.combine.uncertaintyNote}</span>
            </p>
          ) : null}
          <p className="mt-2 text-sm">{set.combine.description}</p>
        </section>
        <form
          className="space-y-2 rounded-3xl border border-dashed border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const current = snapshot();
            if (!current || !splitStep) return;
            commit(splitOffSection(current, splitStep, splitName, createId()));
          }}
        >
          <h2 className="font-semibold">Split by hand</h2>
          <label className="block text-sm">
            Section name
            <input
              value={splitName}
              onChange={(event) => setSplitName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line px-2 py-2"
            />
          </label>
          <label className="block text-sm">
            Start at step
            <select
              aria-label="Start new section at step"
              value={splitStep}
              onChange={(event) => setSplitStep(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line px-2 py-2"
            >
              <option value="">Choose a step</option>
              {steps.map((step) => (
                <option key={step.id} value={step.id}>
                  Step {step.stepNumber}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-10 rounded-full border border-ink/15 px-3 text-sm font-semibold">
            Split section
          </button>
        </form>
      </main>
    </>
  );
}
