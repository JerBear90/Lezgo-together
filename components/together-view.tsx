"use client";

import { orderedSteps } from "@/lib/editing";
import { uncertaintyLabel } from "@/lib/labels";
import { playerStatusLabel } from "@/lib/player";
import { assignSection, playableSteps, progressFor, splitOffSection } from "@/lib/sections";
import { MissingSet } from "./missing-set";
import { BenchLoading, UnsureBadge } from "./ui";
import { usePlayers } from "./use-players";
import { useBrickSet } from "./use-set";
import { RoomSync } from "./room-sync";
import { ShareRoom } from "./share-room";
import { createId } from "@/lib/ids";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clearMembership, readMembership, writeMembership } from "@/lib/rooms/membership";
import { lobbyMembers, partyHeadline, type RoomPlayer } from "@/lib/rooms/model";

export function TogetherView({ id }: { id: string }) {
  const { set, loading, missing, commit, snapshot } = useBrickSet(id);
  const { active } = usePlayers();
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [splitName, setSplitName] = useState("Cabin");
  const [splitStep, setSplitStep] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [handoffOk, setHandoffOk] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const queued = useRef(false);

  useEffect(() => {
    let stop = false;
    async function load() {
      const membership = readMembership();
      if (!membership || membership.setId !== id) {
        if (!stop) {
          setRoomPlayers([]);
          setRoomCode(null);
        }
        return;
      }
      setRoomCode(membership.code);
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

  const roster = lobbyMembers(roomCode, roomPlayers);

  useEffect(() => {
    if (queued.current || !set || roster.length < 2) return;
    if (set.sections.some((section) => section.assigneeId)) return;
    queued.current = true;
    const next = roster.reduce(
      (current, person, index) => {
        const section = current.sections[index];
        return section ? assignSection(current, section.id, person.id) : current;
      },
      set,
    );
    commit(next);
  }, [set, roster, commit]);

  if (loading || !active) return <BenchLoading label="Opening the room" />;
  if (missing || !set) return <MissingSet />;

  const steps = orderedSteps(set.pages, set.steps);
  const assignable = roster.some((person) => person.id === active.id)
    ? roster
    : [{ id: active.id, name: active.name, color: active.color, lastSeenAt: 0 }, ...roster];
  const mineIndex = set.sections.findIndex((section) => section.assigneeId === active.id);
  const previous = mineIndex > 0 ? set.sections[mineIndex - 1] : undefined;
  const following = mineIndex >= 0 ? set.sections[mineIndex + 1] : undefined;
  const previousName = roster.find((person) => person.id === previous?.assigneeId)?.name;
  const followingName = roster.find((person) => person.id === following?.assigneeId)?.name;

  async function leaveParty() {
    const membership = readMembership();
    if (membership) {
      await fetch(`/api/rooms/${membership.code}?player=${encodeURIComponent(membership.playerId)}`, { method: "DELETE" });
      clearMembership();
    }
    setRoomCode(null);
    setLeaveOpen(false);
  }

  async function dropIn() {
    if (!roomCode || !active || !set) return;
    await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: roomCode, player: active }),
    });
    writeMembership({ code: roomCode, playerId: active.id, setId: set.id });
  }
  const placeNote = set.combine.certainty === "uncertain" ? set.combine.uncertaintyNote : null;

  return (
    <>
      <RoomSync setId={id} />
      <main className="together-lobby min-h-dvh space-y-3 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <a href={`/sets/${id}`} className="text-sm font-extrabold text-white">
            Set
          </a>
          <button type="button" className="text-sm font-extrabold" onClick={() => setLeaveOpen(true)}>
            Leave
          </button>
        </div>
        <p className="text-sm font-bold uppercase tracking-wide text-white/80">Build Together</p>
        <h1 className="font-display text-4xl">{partyHeadline(roster.length)}</h1>
        {roster.length < 2 ? (
          <Link href={`/sets/${id}/play`} data-testid="start-building" className="btn-sun flex min-h-14 items-center justify-center font-extrabold">
            Start building
          </Link>
        ) : null}
        <p data-testid="your-colour">Your colour is {colorName(active.color)}</p>
        <div className="relative mx-auto h-16 w-16">
          {set.coverDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={set.coverDataUrl} alt="" className="absolute inset-3 rounded-2xl object-cover" />
          ) : null}
          {roster.slice(0, 6).map((person, index) => (
            <span
              key={person.id}
              className="absolute h-10 w-10 rounded-full border-2 border-white"
              style={{
                background: person.color,
                left: `${50 + Math.cos((index / Math.max(roster.length, 1)) * Math.PI * 2) * 42}%`,
                top: `${50 + Math.sin((index / Math.max(roster.length, 1)) * Math.PI * 2) * 42}%`,
                transform: "translate(-50%, -50%)",
              }}
              title={person.name}
            />
          ))}
        </div>
        <ShareRoom set={set} player={active} />
        <section className="rounded-3xl border border-line bg-card p-4 text-ink">
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
              <article key={section.id} data-testid="section-card" className="rounded-3xl border border-line bg-card p-3 text-ink">
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
                    {assignable.map((player) => (
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
        <section className="rounded-3xl border border-line bg-card p-4 text-ink">
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
          className="space-y-2 rounded-3xl border border-dashed border-white/40 bg-white p-3 text-ink"
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
        {followingName && !handoffOk ? (
          <p data-testid="give-banner" className="rounded-2xl bg-white px-3 py-3 font-bold text-ink">
            Give to {followingName}{" "}
            <button type="button" className="underline" onClick={() => setHandoffOk(true)}>
              Confirm
            </button>
          </p>
        ) : null}
        {previousName ? (
          <p data-testid="receive-banner" className="rounded-2xl bg-white px-3 py-3 font-bold text-ink">
            Receive from {previousName}{" "}
            <button type="button" className="underline" onClick={() => setHandoffOk(true)}>
              Confirm
            </button>
          </p>
        ) : null}
        <div className="flex gap-2">
          <button type="button" data-testid="drop-out" className="btn-lip px-4 py-2 text-sm font-extrabold text-ink" onClick={() => void leaveParty()}>
            Drop out
          </button>
          <button type="button" data-testid="drop-in" className="btn-lip px-4 py-2 text-sm font-extrabold text-ink" onClick={() => void dropIn()}>
            Drop in
          </button>
        </div>
        {leaveOpen ? (
          <div data-testid="leave-dialog" className="rounded-3xl bg-white p-4 text-ink">
            <p className="font-extrabold">Leave this build?</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-sun px-4 py-2 font-extrabold" onClick={() => void leaveParty()}>
                Leave
              </button>
              <button type="button" className="btn-lip px-4 py-2 font-extrabold" onClick={() => setLeaveOpen(false)}>
                Stay
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}

function colorName(color: string): string {
  const names: Record<string, string> = {
    "#e23d2b": "red",
    "#2f6fdd": "blue",
    "#1d6b48": "green",
    "#ef7d2a": "orange",
    "#7a4cc2": "purple",
    "#c2881a": "yellow",
  };
  return names[color.toLowerCase()] ?? "yellow";
}
