import { RoomError } from "@/lib/rooms/model";
import { joinRoom } from "@/lib/rooms/service";
import type { PlayerProfile } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string; player?: PlayerProfile } | null;
  if (!body?.code || !body.player?.name) {
    return Response.json({ error: "Enter a room code and a player name." }, { status: 400 });
  }
  const player: PlayerProfile = {
    id: body.player.id || crypto.randomUUID(),
    name: body.player.name.trim().slice(0, 24),
    color: body.player.color || "#2f6fdd",
    createdAt: body.player.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  try {
    const room = await joinRoom(body.code, player);
    const seated =
      room.players.find((item) => item.id === player.id) ??
      room.players.find((item) => item.name.toLowerCase() === player.name.toLowerCase());
    return Response.json({
      room,
      player: seated
        ? { ...player, id: seated.id, name: seated.name, color: seated.color }
        : player,
    });
  } catch (error) {
    if (error instanceof RoomError) {
      const status = error.code === "full" ? 409 : error.code === "expired" ? 410 : 404;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    return Response.json({ error: "Could not join that room." }, { status: 500 });
  }
}
