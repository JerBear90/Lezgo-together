"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveSet } from "@/lib/db";
import { writeMembership } from "@/lib/rooms/membership";
import { PLAYER_COLORS, savePlayer, writeActivePlayerId } from "@/lib/players";
import type { BrickSet, PlayerProfile } from "@/lib/types";
import { TopBar } from "./ui";

export function JoinRoom() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PLAYER_COLORS[1]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const player: PlayerProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const response = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, player }),
    });
    const body = (await response.json()) as {
      error?: string;
      room?: { code: string; set: BrickSet };
      player?: PlayerProfile;
    };
    setBusy(false);
    if (!response.ok || !body.room || !body.player) {
      setError(body.error ?? "Could not join that room.");
      return;
    }
    await savePlayer(body.player);
    writeActivePlayerId(body.player.id);
    writeMembership({ code: body.room.code, playerId: body.player.id, setId: body.room.set.id });
    await saveSet(body.room.set);
    router.push(`/sets/${body.room.set.id}`);
  }

  return (
    <>
      <TopBar title="Join a room" backHref="/" backLabel="Sets" />
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4 px-4 py-5">
        <label className="block text-sm font-semibold">
          Room code
          <input
            data-testid="join-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-3 font-display text-2xl tracking-[0.25em]"
            required
          />
        </label>
        <label className="block text-sm font-semibold">
          Your name
          <input
            data-testid="join-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-3"
            required
          />
        </label>
        <div className="flex gap-2" role="radiogroup" aria-label="Player color">
          {PLAYER_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              aria-pressed={color === swatch}
              className="h-8 w-8 rounded-full border-2"
              style={{ background: swatch, borderColor: color === swatch ? "#221910" : "transparent" }}
              onClick={() => setColor(swatch)}
            />
          ))}
        </div>
        {error ? (
          <p data-testid="join-error" className="text-sm text-brick-dark">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          data-testid="join-submit"
          disabled={busy}
          className="min-h-12 w-full rounded-full bg-brick font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Joining…" : "Join build"}
        </button>
      </form>
    </>
  );
}
