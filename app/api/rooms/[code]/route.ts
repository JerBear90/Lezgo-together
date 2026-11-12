import { RoomError } from "@/lib/rooms/model";
import { leaveRoom, patchRoom, readRoom } from "@/lib/rooms/service";
import type { BrickSet, SetProgress } from "@/lib/types";

type Params = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: Params) {
  const { code } = await params;
  const playerId = new URL(request.url).searchParams.get("player") ?? undefined;
  try {
    const room = await readRoom(code, playerId ?? undefined);
    return Response.json({ room });
  } catch (error) {
    return roomError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { code } = await params;
  const body = (await request.json().catch(() => null)) as {
    playerId?: string;
    progress?: SetProgress;
    set?: BrickSet;
  } | null;
  if (!body?.playerId) return Response.json({ error: "Missing player." }, { status: 400 });
  try {
    const room = await patchRoom(code, { playerId: body.playerId, progress: body.progress, set: body.set });
    return Response.json({ room });
  } catch (error) {
    return roomError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { code } = await params;
  const playerId = new URL(request.url).searchParams.get("player");
  if (!playerId) return Response.json({ error: "Missing player." }, { status: 400 });
  const room = await leaveRoom(code, playerId);
  return Response.json({ room });
}

function roomError(error: unknown) {
  if (error instanceof RoomError) {
    const status = error.code === "full" ? 409 : error.code === "expired" ? 410 : 404;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  return Response.json({ error: "The room could not be read." }, { status: 500 });
}
