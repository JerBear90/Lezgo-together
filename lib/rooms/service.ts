import type { BrickSet, PlayerProfile, SetProgress } from "../types";
import { externalizeImages } from "./images";
import { mergeSetSnapshot } from "./merge";
import {
  DROP_AFTER_MS,
  MAX_PLAYERS,
  ROOM_TTL_MS,
  RoomError,
  type RoomPlayer,
  type RoomRecord,
  applyProgress,
  isDropped,
  makeRoomCode,
  normalizeCode,
  seatedPlayers,
  touchPlayer,
} from "./model";
import { getRoomStore } from "./store";

export async function createRoom(set: BrickSet, player: PlayerProfile, now = Date.now()): Promise<RoomRecord> {
  const store = await getRoomStore();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = makeRoomCode();
    if (await store.get(code)) continue;
    const stored = await externalizeImages({ ...set, updatedAt: now }, code);
    const room: RoomRecord = {
      code,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ROOM_TTL_MS,
      maxPlayers: MAX_PLAYERS,
      hostId: player.id,
      set: stored,
      players: [{ id: player.id, name: player.name, color: player.color, lastSeenAt: now }],
    };
    await store.save(room, ttlSeconds(room, now));
    return room;
  }
  throw new RoomError("invalid", "Could not mint a room code. Try again.");
}

export async function joinRoom(code: string, player: PlayerProfile, now = Date.now()): Promise<RoomRecord> {
  const room = await loadActive(code, now);
  const named = room.players.find((item) => item.name.trim().toLowerCase() === player.name.trim().toLowerCase());
  const known = room.players.find((item) => item.id === player.id) ?? named;
  const identity: PlayerProfile = known
    ? { ...player, id: known.id, color: known.color || player.color, name: known.name }
    : player;
  if (!known && seatedPlayers(room, now).length >= room.maxPlayers) {
    throw new RoomError("full", "This room is full. Ask someone to leave, or wait for an empty seat.");
  }
  const next = touchPlayer(room, identity, now);
  await save(next, now);
  return next;
}

export async function readRoom(code: string, playerId?: string, now = Date.now()): Promise<RoomRecord> {
  const room = await loadActive(code, now);
  if (!playerId) return room;
  const player = room.players.find((item) => item.id === playerId);
  if (!player) return room;
  const next = touchPlayer(room, { ...player, createdAt: now, updatedAt: now }, now);
  await save(next, now);
  return next;
}

export async function patchRoom(
  code: string,
  input: { playerId: string; progress?: SetProgress; set?: BrickSet },
  now = Date.now(),
): Promise<RoomRecord> {
  const room = await loadActive(code, now);
  const player = room.players.find((item) => item.id === input.playerId);
  if (!player) throw new RoomError("invalid", "That player is not in this room.");
  let next = touchPlayer(room, { ...player, createdAt: now, updatedAt: now }, now);
  if (input.set) {
    const merged = mergeSetSnapshot(next.set, input.set);
    next = { ...next, set: await externalizeImages(merged, next.code), updatedAt: now };
  }
  if (input.progress) next = applyProgress(next, input.playerId, input.progress, now);
  await save(next, now);
  return next;
}

export async function leaveRoom(code: string, playerId: string, now = Date.now()): Promise<RoomRecord | null> {
  const store = await getRoomStore();
  const room = await store.get(normalizeCode(code));
  if (!room) return null;
  const players = room.players.map((player) =>
    player.id === playerId ? { ...player, lastSeenAt: now - DROP_AFTER_MS - 1 } : player,
  );
  const next = { ...room, players, updatedAt: now };
  await save(next, now);
  return next;
}

export function roomPlayerFor(room: RoomRecord, player: PlayerProfile): RoomPlayer | undefined {
  return (
    room.players.find((item) => item.id === player.id) ??
    room.players.find((item) => item.name.trim().toLowerCase() === player.name.trim().toLowerCase())
  );
}

async function loadActive(code: string, now: number): Promise<RoomRecord> {
  const store = await getRoomStore();
  const room = await store.get(normalizeCode(code));
  if (!room) throw new RoomError("invalid", "That code does not match a room.");
  if (room.expiresAt <= now) {
    await store.delete(room.code);
    throw new RoomError("expired", "That room code has expired. Ask the host for a new one.");
  }
  const dropped = room.players.filter((player) => isDropped(player, now));
  if (dropped.length === 0) return room;
  return { ...room, players: room.players };
}

async function save(room: RoomRecord, now: number): Promise<void> {
  const store = await getRoomStore();
  await store.save(room, ttlSeconds(room, now));
}

function ttlSeconds(room: RoomRecord, now: number): number {
  return Math.max(60, Math.ceil((room.expiresAt - now) / 1000));
}
