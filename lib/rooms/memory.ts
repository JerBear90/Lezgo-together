import type { RoomRecord } from "./model";

const globalRooms = globalThis as { __lezgoRooms?: Map<string, RoomRecord> };

function map(): Map<string, RoomRecord> {
  if (!globalRooms.__lezgoRooms) globalRooms.__lezgoRooms = new Map();
  return globalRooms.__lezgoRooms;
}

export const memoryRoomStore = {
  async get(code: string): Promise<RoomRecord | null> {
    return map().get(code) ?? null;
  },
  async save(room: RoomRecord, ttlSeconds: number): Promise<void> {
    void ttlSeconds;
    map().set(room.code, room);
  },
  async delete(code: string): Promise<void> {
    map().delete(code);
  },
};

export function resetMemoryRooms(): void {
  map().clear();
}
