"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveSet } from "@/lib/db";
import { createBlankSet } from "@/lib/editing";
import { createId } from "@/lib/ids";
import { fileToDataUrl } from "@/lib/images";
import { TopBar } from "./ui";

export function NewSetForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the set a name.");
      return;
    }
    setBusy(true);
    const set = createBlankSet({
      id: createId(),
      name: trimmed.slice(0, 60),
      coverDataUrl: cover,
      now: Date.now(),
    });
    await saveSet(set);
    router.push(`/sets/${set.id}/pages`);
  }

  return (
    <>
      <TopBar title="New set" backHref="/" backLabel="Sets" />
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4 px-4 py-5">
        <label className="block">
          <span className="text-sm font-semibold">Name</span>
          <input
            id="set-name"
            data-testid="set-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            required
            className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-3"
            placeholder="Harbor tug"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Cover photo, optional</span>
          <input
            data-testid="cover-input"
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void fileToDataUrl(file)
                .then(setCover)
                .catch(() => setError("That cover photo could not be read."));
            }}
          />
        </label>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="Cover preview" className="h-32 w-full rounded-2xl object-cover" />
        ) : null}
        {error ? <p className="text-sm text-brick-dark">{error}</p> : null}
        <button
          type="submit"
          data-testid="save-set"
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brick font-semibold text-white disabled:opacity-60"
        >
          Create set
        </button>
      </form>
    </>
  );
}
