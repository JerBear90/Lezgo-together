import { normalizeProgress } from "./player";
import { defaultCombine } from "./sections";
import type { BrickSet, SetProgress } from "./types";

const DB_NAME = "lezgo";
const DB_VERSION = 2;
const STORE = "sets";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains("players")) db.createObjectStore("players", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listSets(): Promise<BrickSet[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const request = tx.objectStore(STORE).getAll();
  const rows = await new Promise<BrickSet[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as BrickSet[]);
    request.onerror = () => reject(request.error);
  });
  await transactionDone(tx);
  db.close();
  return rows.map(normalizeSet).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSet(id: string): Promise<BrickSet | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const request = tx.objectStore(STORE).get(id);
  const row = await new Promise<BrickSet | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as BrickSet | undefined);
    request.onerror = () => reject(request.error);
  });
  await transactionDone(tx);
  db.close();
  return row ? normalizeSet(row) : null;
}

function normalizeSet(raw: BrickSet): BrickSet {
  const legacy = (raw as BrickSet & { progress?: SetProgress }).progress;
  const stored = { ...(raw.progressByPlayer ?? {}) };
  if (Object.keys(stored).length === 0 && legacy) stored.legacy = legacy;
  const progressByPlayer: BrickSet["progressByPlayer"] = {};
  for (const [playerId, progress] of Object.entries(stored)) {
    progressByPlayer[playerId] = normalizeProgress(progress);
  }
  const { progress: _dropped, ...rest } = raw as BrickSet & { progress?: SetProgress };
  void _dropped;
  return {
    ...rest,
    progressByPlayer,
    sections: raw.sections ?? [],
    combine: raw.combine ?? defaultCombine(),
  };
}

export async function saveSet(set: BrickSet): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(set);
  await transactionDone(tx);
  db.close();
}

export async function deleteSet(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await transactionDone(tx);
  db.close();
}
