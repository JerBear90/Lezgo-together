"use client";

import { useEffect, useState } from "react";
import { saveSet } from "@/lib/db";
import { writeMembership } from "@/lib/rooms/membership";
import { formatRoomCode } from "@/lib/rooms/model";
import type { BrickSet } from "@/lib/types";
import type { PlayerProfile } from "@/lib/types";

export function ShareRoom({ set, player }: { set: BrickSet; player: PlayerProfile }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const link = code ? `${window.location.origin}/join?code=${code}` : "";

  useEffect(() => {
    if (!link) return;
    let cancel = false;
    import("qrcode")
      .then((qrcode) => qrcode.default.toDataURL(link, { margin: 1, width: 180 }))
      .then((svg) => {
        if (!cancel) setQr(svg);
      })
      .catch(() => {
        if (!cancel) setQr(null);
      });
    return () => {
      cancel = true;
    };
  }, [link]);

  async function share() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ set, player }),
    });
    const body = (await response.json()) as { error?: string; room?: { code: string; set: BrickSet } };
    setBusy(false);
    if (!response.ok || !body.room) {
      setError(body.error ?? "Could not open a room.");
      return;
    }
    setCode(body.room.code);
    writeMembership({ code: body.room.code, playerId: player.id, setId: set.id });
    await saveSet(body.room.set);
    window.dispatchEvent(new CustomEvent("lezgo-set", { detail: set.id }));
  }

  return (
    <section className="rounded-3xl bg-white/15 p-4 text-white">
      <h2 className="font-display text-2xl">Build room</h2>
      <p className="mt-1 text-sm text-white/80">
        Optional invite. Share a short code if a friend wants to join. No account.
      </p>
      {code ? (
        <div className="mt-3 space-y-3">
          <p data-testid="room-code" className="font-display text-5xl tracking-[0.2em]">
            {formatRoomCode(code)}
          </p>
          {link ? (
            <p className="break-all text-sm">
              <a href={link}>{link}</a>
            </p>
          ) : null}
          {qr ? (
            // The QR is generated in the browser from this room link.
            // eslint-disable-next-line @next/next/no-img-element
            <img data-testid="room-qr" src={qr} alt={`QR code for room ${code}`} className="w-44 rounded-2xl bg-white p-2" />
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          data-testid="share-room"
          disabled={busy}
          onClick={() => void share()}
          className="mt-3 min-h-11 rounded-full bg-ink px-4 font-semibold text-paper disabled:opacity-60"
        >
          {busy ? "Opening room…" : "Create room code"}
        </button>
      )}
      {error ? <p className="mt-2 text-sm text-brick-dark">{error}</p> : null}
    </section>
  );
}
