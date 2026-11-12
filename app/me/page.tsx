"use client";

import { useState } from "react";
import { usePlayers } from "@/components/use-players";
import { PLAYER_COLORS, savePlayer } from "@/lib/players";

const names: Record<string, string> = {
  "#e23d2b": "red",
  "#2f6fdd": "blue",
  "#1d6b48": "green",
  "#ef7d2a": "orange",
  "#7a4cc2": "purple",
  "#c2881a": "yellow",
};

export default function MePage() {
  const { active, loading } = usePlayers();
  const [draft, setDraft] = useState<string | null>(null);
  if (loading || !active) return <p className="px-5 py-8">Opening profile…</p>;
  const profile = active;
  const name = draft ?? profile.name;

  async function save(nextName: string, color: string) {
    await savePlayer({
      ...profile,
      name: nextName.trim().slice(0, 24) || "Builder",
      color,
      updatedAt: Date.now(),
    });
    window.dispatchEvent(new Event("lezgo-players"));
  }

  const colour = names[profile.color.toLowerCase()] ?? "red";

  return (
    <main className="px-5 py-8">
      <h1 className="font-display text-4xl">Me</h1>
      <p className="mt-2 text-sm text-muted">Same builder as the bar at the top. No account.</p>
      <label className="mt-6 block text-sm font-bold">
        Name
        <input
          value={name}
          onChange={(event) => {
            setDraft(event.target.value);
            void save(event.target.value, profile.color);
          }}
          className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-3 font-bold"
        />
      </label>
      <p className="mt-5 text-sm font-bold" data-testid="me-colour">
        Your colour is {colour}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PLAYER_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={names[swatch] ?? swatch}
            onClick={() => void save(name, swatch)}
            className={`btn-lip min-h-11 px-3 text-sm font-extrabold ${profile.color === swatch ? "btn-sun" : ""}`}
          >
            {names[swatch] ?? swatch}
          </button>
        ))}
      </div>
    </main>
  );
}
