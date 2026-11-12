import type { BrickSet, PlayerProfile, SetProgress } from "../types";

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const DROP_AFTER_MS = 45_000;
export const MAX_PLAYERS = 6;
export const CODE_ALPHABET = "0123456789";

export type RoomPlayer = {
  id: string;
  name: string;
  color: string;
  lastSeenAt: number;
};

export type RoomRecord = {
  code: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  maxPlayers: number;
  hostId: string;
  set: BrickSet;
  players: RoomPlayer[];
};

export type RoomErrorCode = "invalid" | "expired" | "full";

export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatRoomCode(code: string): string {
  const compact = code.replace(/\s/g, "");
  if (compact.length < 4) return compact;
  const mid = Math.ceil(compact.length / 2);
  return `${compact.slice(0, mid)} ${compact.slice(mid)}`;
}

export function makeRoomCode(length = 6, random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function isDropped(player: RoomPlayer, now: number): boolean {
  return now - player.lastSeenAt > DROP_AFTER_MS;
}

export function seatedPlayers(room: RoomRecord, now: number): RoomPlayer[] {
  return room.players.filter((player) => !isDropped(player, now));
}

export function touchPlayer(room: RoomRecord, player: PlayerProfile, now: number): RoomRecord {
  const existing = room.players.find((item) => item.id === player.id);
  const players = existing
    ? room.players.map((item) =>
        item.id === player.id ? { ...item, name: player.name, color: player.color, lastSeenAt: now } : item,
      )
    : [...room.players, { id: player.id, name: player.name, color: player.color, lastSeenAt: now }];
  return { ...room, players, updatedAt: now };
}

export function applyProgress(room: RoomRecord, playerId: string, progress: SetProgress, now: number): RoomRecord {
  const current = room.set.progressByPlayer?.[playerId];
  if (current && current.updatedAt > progress.updatedAt) return room;
  return {
    ...room,
    updatedAt: now,
    set: {
      ...room.set,
      progressByPlayer: {
        ...room.set.progressByPlayer,
        [playerId]: progress,
      },
    },
  };
}
