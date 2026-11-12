"use client";

import { useState } from "react";
import { PLAYER_COLORS } from "@/lib/players";
import { usePlayers } from "./use-players";

export function PlayerBar() {
  const { players, active, loading, switchTo, add } = usePlayers();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PLAYER_COLORS[1]);

  if (loading || !active) return <div className="h-11 border-b border-line bg-paper" />;

  return (
    <div className="border-b border-line bg-paper px-4 py-2">
      <div className="flex items-center gap-2">
        <span
          data-testid="active-player"
          className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold"
        >
          <span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-full border border-ink/10" style={{ background: active.color }} />
          <span className="truncate">{active.name}</span>
        </span>
        <button
          type="button"
          data-testid="player-menu"
          className="rounded-full border border-line px-3 py-1 text-sm font-semibold"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Players"}
        </button>
      </div>
      {open ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                data-testid="switch-player"
                data-player-name={player.name}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-sm"
                onClick={() => {
                  switchTo(player.id);
                  setOpen(false);
                }}
              >
                <span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ background: player.color }} />
                {player.name}
              </button>
            ))}
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void add(name, color).then(() => {
                setName("");
                setOpen(false);
              });
            }}
          >
            <input
              data-testid="player-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Player name"
              aria-label="Player name"
              className="min-w-0 flex-1 rounded-xl border border-line px-2 py-2 text-sm"
            />
            <div className="flex gap-1" role="radiogroup" aria-label="Player color">
              {PLAYER_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={swatch}
                  aria-pressed={color === swatch}
                  className="h-6 w-6 rounded-full border-2"
                  style={{ background: swatch, borderColor: color === swatch ? "#221910" : "transparent" }}
                  onClick={() => setColor(swatch)}
                />
              ))}
            </div>
            <button type="submit" data-testid="save-player" className="rounded-full bg-ink px-3 py-2 text-sm font-semibold text-paper">
              Add player
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
