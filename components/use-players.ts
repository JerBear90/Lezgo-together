"use client";

import { useCallback, useEffect, useState } from "react";
import { ensurePlayers, listPlayers, savePlayer, writeActivePlayerId } from "@/lib/players";
import type { PlayerProfile } from "@/lib/types";

export function usePlayers() {
  const [players, setPlayers] = useState<PlayerProfile[] | undefined>(undefined);
  const [active, setActive] = useState<PlayerProfile | null>(null);

  const refresh = useCallback(async () => {
    const result = await ensurePlayers();
    setPlayers(result.players);
    setActive(result.active);
    return result;
  }, []);

  useEffect(() => {
    let cancel = false;
    ensurePlayers()
      .then((result) => {
        if (cancel) return;
        setPlayers(result.players);
        setActive(result.active);
      })
      .catch(() => {
        if (!cancel) setPlayers([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const switchTo = useCallback(
    (id: string) => {
      writeActivePlayerId(id);
      setActive(players?.find((player) => player.id === id) ?? null);
    },
    [players],
  );

  const add = useCallback(
    async (name: string, color: string) => {
      const now = Date.now();
      const player: PlayerProfile = {
        id: crypto.randomUUID(),
        name: name.trim().slice(0, 24) || "Player",
        color,
        createdAt: now,
        updatedAt: now,
      };
      await savePlayer(player);
      writeActivePlayerId(player.id);
      const next = await listPlayers();
      setPlayers(next);
      setActive(next.find((item) => item.id === player.id) ?? player);
      return player;
    },
    [],
  );

  return { players: players ?? [], active, loading: players === undefined, refresh, switchTo, add };
}
