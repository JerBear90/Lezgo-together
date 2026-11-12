import { memoryRoomStore } from "./memory";
import type { RoomRecord } from "./model";

export type RoomStore = {
  get(code: string): Promise<RoomRecord | null>;
  save(room: RoomRecord, ttlSeconds: number): Promise<void>;
  delete(code: string): Promise<void>;
};

export function redisConfigured(): boolean {
  return Boolean(process.env["UPSTASH_REDIS_REST_URL"] && process.env["UPSTASH_REDIS_REST_TOKEN"]);
}

export function blobConfigured(): boolean {
  return Boolean(process.env["BLOB_READ_WRITE_TOKEN"]);
}

export async function getRoomStore(): Promise<RoomStore> {
  if (!redisConfigured()) return memoryRoomStore;
  const { Redis } = await import("@upstash/redis");
  const redis = Redis.fromEnv();
  return {
    async get(code) {
      const value = await redis.get<RoomRecord>(roomKey(code));
      return value ?? null;
    },
    async save(room, ttlSeconds) {
      await redis.set(roomKey(room.code), room, { ex: ttlSeconds });
    },
    async delete(code) {
      await redis.del(roomKey(code));
    },
  };
}

function roomKey(code: string): string {
  return `lezgo:room:${code}`;
}
