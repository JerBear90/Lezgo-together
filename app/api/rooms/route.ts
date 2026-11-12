import { RoomError } from "@/lib/rooms/model";
import { createRoom } from "@/lib/rooms/service";
import { blobConfigured, redisConfigured } from "@/lib/rooms/store";
import type { BrickSet, PlayerProfile } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { set?: BrickSet; player?: PlayerProfile } | null;
  if (!body?.set?.id || !body.player?.id || !body.player.name) {
    return Response.json({ error: "A set and a player are required." }, { status: 400 });
  }
  try {
    const room = await createRoom(body.set, body.player);
    return Response.json({
      room,
      mode: redisConfigured() ? "redis" : "memory",
      images: blobConfigured() ? "blob" : "inline",
    });
  } catch (error) {
    return roomError(error);
  }
}

function roomError(error: unknown) {
  if (error instanceof RoomError) {
    const status = error.code === "full" ? 409 : error.code === "expired" ? 410 : 404;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  return Response.json({ error: "The room could not be saved." }, { status: 500 });
}
