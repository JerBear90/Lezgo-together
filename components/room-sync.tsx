"use client";

import { useEffect } from "react";
import { getSet, saveSet } from "@/lib/db";
import { mergeSetSnapshot } from "@/lib/rooms/merge";
import { readMembership } from "@/lib/rooms/membership";
import { progressFor } from "@/lib/sections";
import { usePlayers } from "./use-players";

export function RoomSync({ setId }: { setId: string }) {
  const { active } = usePlayers();

  useEffect(() => {
    if (!active) return;
    const playerId = active.id;
    let stop = false;

    async function tick() {
      const membership = readMembership();
      if (!membership || membership.setId !== setId || stop) return;
      const local = await getSet(setId);
      if (!local || stop) return;
      const response = await fetch(`/api/rooms/${membership.code}?player=${playerId}`);
      if (!response.ok || stop) return;
      const body = (await response.json()) as { room?: { set: typeof local } };
      if (!body.room) return;
      const merged = mergeSetSnapshot(local, body.room.set);
      await saveSet(merged);
      if (stop) return;
      window.dispatchEvent(new CustomEvent("lezgo-set", { detail: setId }));
      await fetch(`/api/rooms/${membership.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          progress: progressFor(merged, playerId),
          set: merged,
        }),
      });
    }

    void tick();
    const timer = window.setInterval(() => void tick(), 1500);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [active, setId]);

  return null;
}
