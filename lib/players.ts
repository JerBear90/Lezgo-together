import type { PlayerProfile } from "./types";

const DB_NAME = "lezgo";
const DB_VERSION = 2;
const PLAYERS = "players";
const ACTIVE_KEY = "lezgo.activePlayerId";

export const PLAYER_COLORS = ["#e23d2b", "#2f6fdd", "#1d6b48", "#ef7d2a", "#7a4cc2", "#c2881a"] as const;

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sets")) db.createObjectStore("sets", { keyPath: "id" });
      if (!db.objectStoreNames.contains(PLAYERS)) db.createObjectStore(PLAYERS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listPlayers(): Promise<PlayerProfile[]> {
  const db = await openDb();
  const tx = db.transaction(PLAYERS, "readonly");
  const request = tx.objectStore(PLAYERS).getAll();
  const rows = await new Promise<PlayerProfile[]>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as PlayerProfile[]) ?? []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function savePlayer(player: PlayerProfile): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PLAYERS, "readwrite");
  tx.objectStore(PLAYERS).put(player);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function readActivePlayerId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function writeActivePlayerId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export async function ensurePlayers(): Promise<{ players: PlayerProfile[]; active: PlayerProfile }> {
  const existing = await listPlayers();
  let players = existing;
  if (players.length === 0) {
    const now = Date.now();
    const first: PlayerProfile = {
      id: crypto.randomUUID(),
      name: "Builder",
      color: PLAYER_COLORS[0],
      createdAt: now,
      updatedAt: now,
    };
    await savePlayer(first);
    players = [first];
  }
  const stored = readActivePlayerId();
  const active = players.find((player) => player.id === stored) ?? players[0];
  writeActivePlayerId(active.id);
  return { players, active };
}
