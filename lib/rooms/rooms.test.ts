import { afterEach, describe, expect, it } from "vitest";
import { buildDemoSet } from "../demo";
import { emptyProgress } from "../player";
import { savePlayerProgress } from "../sections";
import { mergePlayerProgress, mergeSetSnapshot } from "./merge";
import { resetMemoryRooms } from "./memory";
import { DROP_AFTER_MS, MAX_PLAYERS, formatRoomCode, lobbyMembers, makeRoomCode, partyHeadline } from "./model";
import { createRoom, joinRoom, patchRoom, readRoom } from "./service";
import { memoryRoomStore } from "./memory";
import type { PlayerProfile } from "../types";

function player(id: string, name: string): PlayerProfile {
  return { id, name, color: "#e23d2b", createdAt: 1, updatedAt: 1 };
}

function stamp<T extends { progressByPlayer: Record<string, { updatedAt: number }> }>(set: T, playerId: string, updatedAt: number): T {
  return {
    ...set,
    progressByPlayer: {
      ...set.progressByPlayer,
      [playerId]: { ...set.progressByPlayer[playerId], updatedAt },
    },
  };
}

describe("room sync", () => {
  it("shows a 6-digit code as two groups", () => {
    expect(formatRoomCode("123456")).toBe("123 456");
    expect(makeRoomCode(6, () => 0)).toBe("000000");
  });

  it("counts only people who joined the room", () => {
    const local = [{ id: "a" }, { id: "b" }];
    expect(lobbyMembers(null, local)).toEqual([]);
    expect(partyHeadline(0)).toBe("Build solo or invite friends");
    expect(partyHeadline(1)).toBe("Build solo or invite friends");
    expect(lobbyMembers("123456", local)).toEqual(local);
    expect(partyHeadline(2)).toBe("Start party!");
  });

  it("lets one builder open a room and finish a step", async () => {
    const now = 20_000;
    const room = await createRoom(buildDemoSet(now), player("solo", "Builder"), now);
    expect(room.players).toHaveLength(1);
    const done = await patchRoom(
      room.code,
      {
        playerId: "solo",
        progress: {
          ...emptyProgress(),
          currentStepId: "demo-step-2",
          checkedByStep: { "demo-step-1": ["demo-step-1-p1"] },
          updatedAt: now + 5,
        },
      },
      now + 5,
    );
    expect(done.players).toHaveLength(1);
    expect(done.set.progressByPlayer.solo.currentStepId).toBe("demo-step-2");
    expect(done.set.progressByPlayer.solo.checkedByStep["demo-step-1"]).toEqual(["demo-step-1-p1"]);
  });

  afterEach(() => resetMemoryRooms());

  it("rejects an unknown code and an expired room", async () => {
    await expect(readRoom("ZZZZZ")).rejects.toMatchObject({ code: "invalid" });
    const room = await createRoom(buildDemoSet(1), player("host", "Builder"), 1_000);
    await memoryRoomStore.save({ ...room, expiresAt: 1 }, 60);
    await expect(readRoom(room.code, undefined, 5_000)).rejects.toMatchObject({ code: "expired" });
  });

  it("fills up, frees a dropped seat, and restores a returning name", async () => {
    const now = 10_000;
    const host = player("host", "Builder");
    const room = await createRoom(buildDemoSet(now), host, now);
    for (let i = 0; i < MAX_PLAYERS - 1; i += 1) {
      await joinRoom(room.code, player(`p${i}`, `P${i}`), now);
    }
    await expect(joinRoom(room.code, player("extra", "Extra"), now)).rejects.toMatchObject({ code: "full" });

    const seated = await readRoom(room.code, undefined, now);
    const stale = seated.players[1];
    await memoryRoomStore.save(
      {
        ...seated,
        players: seated.players.map((item) =>
          item.id === stale.id ? { ...item, lastSeenAt: now - DROP_AFTER_MS - 5 } : item,
        ),
      },
      3600,
    );
    const joined = await joinRoom(room.code, player("newbie", "Newbie"), now);
    expect(joined.players.some((item) => item.name === "Newbie")).toBe(true);

    const back = await joinRoom(room.code, player("other-id", "Builder"), now + 1000);
    expect(back.players.find((item) => item.name === "Builder")?.id).toBe("host");
  });

  it("keeps the other player's checks when two people update the same part", () => {
    const set = buildDemoSet(1);
    const ada = stamp(
      savePlayerProgress(set, "ada", {
        ...emptyProgress(),
        currentStepId: "demo-step-1",
        checkedByStep: { "demo-step-1": ["demo-step-1-p1"] },
      }),
      "ada",
      10,
    );
    const both = stamp(
      savePlayerProgress(ada, "bea", {
        ...emptyProgress(),
        currentStepId: "demo-step-4",
        checkedByStep: { "demo-step-4": ["demo-step-4-p1"] },
      }),
      "bea",
      20,
    );
    const adaLater = stamp(
      savePlayerProgress(both, "ada", {
        ...both.progressByPlayer.ada,
        checkedByStep: { "demo-step-1": [] },
      }),
      "ada",
      5,
    );
    const merged = mergeSetSnapshot(both, adaLater);
    expect(merged.progressByPlayer.bea.checkedByStep["demo-step-4"]).toEqual(["demo-step-4-p1"]);
    expect(merged.progressByPlayer.ada.checkedByStep["demo-step-1"]).toEqual(["demo-step-1-p1"]);
    const newerAda = stamp(
      savePlayerProgress(both, "ada", {
        ...both.progressByPlayer.ada,
        checkedByStep: { "demo-step-1": [] },
      }),
      "ada",
      30,
    );
    const won = mergePlayerProgress(merged.progressByPlayer, newerAda.progressByPlayer);
    expect(won.ada.checkedByStep["demo-step-1"]).toEqual([]);
    expect(won.bea.checkedByStep["demo-step-4"]).toEqual(["demo-step-4-p1"]);
  });

  it("patches one player without erasing the other", async () => {
    const now = 50_000;
    const room = await createRoom(buildDemoSet(now), player("ada", "Ada"), now);
    await joinRoom(room.code, player("bea", "Bea"), now);
    await patchRoom(
      room.code,
      {
        playerId: "ada",
        progress: { ...emptyProgress(), currentStepId: "demo-step-2", checkedByStep: { "demo-step-1": ["demo-step-1-p1"] }, updatedAt: now + 5 },
      },
      now + 5,
    );
    const after = await patchRoom(
      room.code,
      {
        playerId: "bea",
        progress: { ...emptyProgress(), currentStepId: "demo-step-4", checkedByStep: { "demo-step-4": ["demo-step-4-p1"] }, updatedAt: now + 6 },
      },
      now + 6,
    );
    expect(after.set.progressByPlayer.ada.currentStepId).toBe("demo-step-2");
    expect(after.set.progressByPlayer.bea.checkedByStep["demo-step-4"]).toEqual(["demo-step-4-p1"]);
  });
});
