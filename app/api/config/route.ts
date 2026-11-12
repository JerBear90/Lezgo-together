import { connection } from "next/server";
import { aiConfigured, visionModel } from "@/lib/ai";

export async function GET() {
  await connection();
  const live = aiConfigured();
  return Response.json({
    mode: live ? "live" : "demo",
    model: live ? visionModel() : null,
  });
}
