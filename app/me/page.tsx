"use client";

import { useSyncExternalStore } from "react";

const colors = ["Yellow", "Red", "Blue", "Green", "Orange", "Purple"];

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("lezgo-me", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("lezgo-me", onStoreChange);
  };
}

function readRaw() {
  return window.localStorage.getItem("lezgo-me") ?? "";
}

function parseProfile(raw: string) {
  if (!raw) return { name: "Builder", color: "Yellow" };
  try {
    const parsed = JSON.parse(raw) as { name?: string; color?: string };
    return { name: parsed.name || "Builder", color: parsed.color || "Yellow" };
  } catch {
    return { name: "Builder", color: "Yellow" };
  }
}

export default function MePage() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const profile = parseProfile(raw);

  function save(name: string, color: string) {
    window.localStorage.setItem("lezgo-me", JSON.stringify({ name: name.slice(0, 24), color }));
    window.dispatchEvent(new Event("lezgo-me"));
  }

  return (
    <main className="px-5 py-8">
      <h1 className="font-display text-4xl">Me</h1>
      <p className="mt-2 text-sm text-muted">A name and a colour on this device. No account.</p>
      <label className="mt-6 block text-sm font-bold">
        Name
        <input
          value={profile.name}
          onChange={(event) => save(event.target.value, profile.color)}
          className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-3 font-bold"
        />
      </label>
      <p className="mt-5 text-sm font-bold">Your colour is {profile.color.toLowerCase()}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {colors.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => save(profile.name, swatch)}
            className={`btn-lip min-h-11 px-3 text-sm font-extrabold ${profile.color === swatch ? "btn-sun" : ""}`}
          >
            {swatch}
          </button>
        ))}
      </div>
    </main>
  );
}
